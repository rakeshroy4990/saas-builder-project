"""
PostgreSQL backend for pdf-rag-pipeline (chunks FTS, query cache, pdf registry).
Mirrors Mongo collections: chunks, query_cache, pdf_registry.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from psycopg.rows import dict_row
from psycopg.types.json import Json
from psycopg_pool import ConnectionPool

from config.settings import DATABASE_URL, EMBEDDING_DIMENSION, PG_TEXT_SEARCH_MIN_SCORE

LOG = logging.getLogger(__name__)

_pool: Optional[ConnectionPool] = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        if not DATABASE_URL or not DATABASE_URL.strip():
            raise RuntimeError("DATABASE_URL is required when APP_PERSISTENCE_PROVIDER=postgres")
        _pool = ConnectionPool(
            conninfo=DATABASE_URL.strip(),
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
        )
    return _pool


def _run_ddl_file(conn, path: Path) -> None:
    raw = path.read_text(encoding="utf-8")
    # Strip line comments; split on semicolons for simple multi-statement DDL.
    lines = []
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        if "--" in line:
            line = line.split("--", 1)[0]
        lines.append(line)
    cleaned = "\n".join(lines)
    with conn.cursor() as cur:
        for stmt in re.split(r";\s*", cleaned):
            s = stmt.strip()
            if s:
                cur.execute(s)


_RAG_INGEST_ALIAS_NAMES = frozenset({"rag_ingest_jobs", "rag_ingest_batches"})


def _drop_public_named_relation_if_exists(cur, relname: str) -> None:
    """Remove a table or view in public so we can recreate an alias view with this name."""
    if relname not in _RAG_INGEST_ALIAS_NAMES:
        raise ValueError(f"refusing to drop unexpected relation name: {relname!r}")
    cur.execute(
        """
        SELECT c.relkind AS k
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = %s AND n.nspname = 'public'
        """,
        (relname,),
    )
    row = cur.fetchone()
    if not row:
        return
    kind = (row.get("k") or "").strip()
    if kind == "r":
        cur.execute(f"DROP TABLE public.{relname} CASCADE")
    elif kind == "v":
        cur.execute(f"DROP VIEW public.{relname} CASCADE")


def _ensure_rag_ingest_alias_views(conn) -> None:
    """
    Tooling may expect `rag_ingest_jobs` / `rag_ingest_batches`. Canonical tables are
    `rag_marker_jobs` and `rag_marker_batches` (where Marker POST /ingest/marker writes).

    PostgreSQL rejects `DROP VIEW IF EXISTS` when the name is a TABLE, so we inspect relkind.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        _drop_public_named_relation_if_exists(cur, "rag_ingest_jobs")
        cur.execute(
            """
            CREATE VIEW public.rag_ingest_jobs AS
            SELECT
                id,
                file_hash,
                filepath,
                filename,
                total_pages,
                batch_size,
                status,
                error,
                ingest_meta,
                created_at,
                updated_at
            FROM public.rag_marker_jobs
            """
        )

        _drop_public_named_relation_if_exists(cur, "rag_ingest_batches")
        cur.execute(
            """
            CREATE VIEW public.rag_ingest_batches AS
            SELECT
                id,
                job_id,
                batch_index,
                page_start,
                page_end,
                status,
                error,
                marker_stats,
                created_at
            FROM public.rag_marker_batches
            """
        )


def ensure_postgres_schema() -> None:
    path = Path(__file__).resolve().parent / "postgres_schema.sql"
    with get_pool().connection() as conn:
        _run_ddl_file(conn, path)
        _ensure_rag_ingest_alias_views(conn)
        conn.commit()
    LOG.info("postgres schema ensured from %s", path.name)


def _float_score(val: Any) -> float:
    if val is None:
        return 0.0
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _match_extra_filters(match: dict[str, Any]) -> tuple[str, list[Any]]:
    """WHERE fragments after the full-text match (AND ...)."""
    parts: list[str] = []
    params: list[Any] = []

    if "source_file" in match:
        parts.append("c.source_file = %s")
        params.append(match["source_file"])

    ct = match.get("metadata.chapter_topic")
    if isinstance(ct, dict) and "$in" in ct:
        topics = ct["$in"]
        if topics:
            # Include unlabeled / weakly classified rows so intent filters do not drop
            # on-topic chunks (e.g. cough sections labeled "general" because "cough"
            # was missing from page_topic_keywords at ingest).
            parts.append(
                "((c.metadata->>'chapter_topic') IS NULL "
                " OR (c.metadata->>'chapter_topic') = 'general' "
                " OR (c.metadata->>'chapter_topic') = ANY(%s::text[]))"
            )
            params.append(list(topics))

    # Do not filter FTS retrieval by metadata.audience: it tags *source* tone from filename
    # rules, not access control—expert users (clinicians) must still retrieve layman-tagged
    # guideline chunks; answer tone uses infer_user_audience() in the LLM path only.

    return (" AND " + " AND ".join(parts)) if parts else "", params


def chunks_text_search(
    match: dict[str, Any],
    candidate_limit: int,
    min_score: float,
    apply_score_filter: bool,
    *,
    book_name: Optional[str] = None,
    include_outdated_books: bool = False,
) -> list[dict[str, Any]]:
    """
    Return chunk dicts aligned with Mongo aggregate projection:
    text, source_file, page_num, tags, metadata, score
    """
    text_search = match["$text"]["$search"]
    extra_sql, extra_params = _match_extra_filters(match)
    threshold = max(float(min_score), float(PG_TEXT_SEARCH_MIN_SCORE))

    join_sql = " LEFT JOIN rag_pdf_registry reg ON reg.file_hash = c.file_hash "
    registry_parts: list[str] = []
    registry_params: list[Any] = []
    bn = str(book_name or "").strip()
    if bn:
        registry_parts.append(
            "(reg.book_name IS NOT NULL AND BTRIM(reg.book_name) = BTRIM(%s))"
        )
        registry_params.append(bn)
    if not include_outdated_books:
        registry_parts.append(
            "(reg.file_hash IS NULL OR reg.book_status IS NULL OR "
            "LOWER(BTRIM(COALESCE(reg.book_status, ''))) <> %s)"
        )
        registry_params.append("outdated")
    registry_sql = (" AND " + " AND ".join(registry_parts)) if registry_parts else ""

    score_where = "rank_score >= %s" if apply_score_filter else "TRUE"
    inner_sql = f"""
        SELECT c.text, c.source_file, c.page_num, c.tags, c.metadata,
               ts_rank_cd(c.search_vector, qt.q) AS rank_score
        FROM rag_chunks c
        {join_sql}
        CROSS JOIN (SELECT plainto_tsquery('english', %s) AS q) qt
        WHERE c.search_vector @@ qt.q{extra_sql}{registry_sql}
    """
    sql = f"""
        SELECT text, source_file, page_num, tags, metadata, rank_score AS score
        FROM ({inner_sql}) sub
        WHERE {score_where}
        ORDER BY rank_score DESC
        LIMIT %s
    """
    params: list[Any] = [text_search, *extra_params, *registry_params]
    if apply_score_filter:
        params.append(threshold)
    params.append(int(candidate_limit))

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()

    out: list[dict[str, Any]] = []
    for row in rows:
        tags = row.get("tags")
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except json.JSONDecodeError:
                tags = []
        if not isinstance(tags, list):
            tags = []
        meta = row.get("metadata")
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except json.JSONDecodeError:
                meta = {}
        if not isinstance(meta, dict):
            meta = {}
        out.append(
            {
                "text": row.get("text", ""),
                "source_file": row.get("source_file", ""),
                "page_num": row.get("page_num", 0),
                "tags": tags,
                "metadata": meta,
                "score": _float_score(row.get("score")),
            }
        )
    return out


def chunks_replace_for_file_hash(file_hash: str, chunks: list[dict[str, Any]]) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM rag_chunks WHERE file_hash = %s", (file_hash,))
            for ch in chunks:
                cur.execute(
                    """
                    INSERT INTO rag_chunks (text, source_file, file_hash, page_num, chunk_index, metadata, tags, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        ch.get("text", ""),
                        ch.get("source_file", ""),
                        file_hash,
                        int(ch.get("page_num", 0)),
                        int(ch.get("chunk_index", 0)),
                        Json(ch.get("metadata") or {}),
                        Json(ch.get("tags") if isinstance(ch.get("tags"), list) else []),
                        ch.get("created_at") or datetime.now(timezone.utc),
                    ),
                )
        conn.commit()


def query_cache_find_one(cache_id: str) -> Optional[dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT answer, follow_up_questions
                FROM rag_query_cache
                WHERE id = %s AND expires_at > now()
                """,
                (cache_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    raw_fu = row.get("follow_up_questions")
    if isinstance(raw_fu, list):
        follow = [str(x).strip() for x in raw_fu if str(x).strip()][:6]
    elif isinstance(raw_fu, str):
        try:
            arr = json.loads(raw_fu)
            follow = [str(x).strip() for x in arr if str(x).strip()][:6] if isinstance(arr, list) else []
        except json.JSONDecodeError:
            follow = []
    else:
        follow = []
    return {"answer": str(row.get("answer", "")).strip(), "follow_up_questions": follow}


def query_cache_upsert(
    cache_id: str,
    query: str,
    audience: str,
    user_id: str,
    answer: str,
    follow_up_questions: list[str],
    cached_at: datetime,
    expires_at: datetime,
) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rag_query_cache (id, query, audience, user_id, answer, follow_up_questions, cached_at, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    query = EXCLUDED.query,
                    audience = EXCLUDED.audience,
                    user_id = EXCLUDED.user_id,
                    answer = EXCLUDED.answer,
                    follow_up_questions = EXCLUDED.follow_up_questions,
                    cached_at = EXCLUDED.cached_at,
                    expires_at = EXCLUDED.expires_at
                """,
                (
                    cache_id,
                    query,
                    audience,
                    user_id,
                    answer,
                    Json(list(follow_up_questions or [])),
                    cached_at,
                    expires_at,
                ),
            )
        conn.commit()


def pdf_registry_processed_hashes() -> set[str]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT file_hash FROM rag_pdf_registry WHERE status = %s",
                ("processed",),
            )
            return {str(r["file_hash"]) for r in cur.fetchall() if r and r.get("file_hash")}


def pdf_registry_mark(file_hash: str, status: str, **kwargs: Any) -> None:
    """Upsert pdf row; NULL kwargs do not overwrite existing columns (Mongo $set partial semantics)."""
    filename = kwargs.get("filename")
    filepath = kwargs.get("filepath")
    error = kwargs.get("error")
    chunks_count = kwargs.get("chunks_count")
    ingested_at = kwargs.get("ingested_at")
    prefilter_stats = kwargs.get("prefilter_stats")
    image_stats = kwargs.get("image_stats")
    book_name = kwargs.get("book_name")
    book_status = kwargs.get("book_status")
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM rag_pdf_registry WHERE file_hash = %s", (file_hash,))
            existing = cur.fetchone()
        merged: dict[str, Any] = dict(existing) if existing else {}
        merged["file_hash"] = file_hash
        merged["status"] = status
        if filename is not None:
            merged["filename"] = filename
        if filepath is not None:
            merged["filepath"] = filepath
        if error is not None:
            merged["error"] = error
        if chunks_count is not None:
            merged["chunks_count"] = int(chunks_count)
        if ingested_at is not None:
            merged["ingested_at"] = ingested_at
        if prefilter_stats is not None:
            merged["prefilter_stats"] = prefilter_stats
        if image_stats is not None:
            merged["image_stats"] = image_stats
        if book_name is not None:
            merged["book_name"] = str(book_name).strip() or None
        if book_status is not None:
            merged["book_status"] = book_status
        if status == "processed" and ingested_at is None and merged.get("ingested_at") is None:
            merged["ingested_at"] = datetime.now(timezone.utc)

        ps = merged.get("prefilter_stats")
        ps_json = Json(ps) if isinstance(ps, dict) else Json({})
        ims = merged.get("image_stats")
        ims_json = Json(ims) if isinstance(ims, dict) else Json({})

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rag_pdf_registry (
                    file_hash, status, filename, filepath, error, chunks_count, ingested_at,
                    prefilter_stats, image_stats, book_name, book_status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (file_hash) DO UPDATE SET
                    status = EXCLUDED.status,
                    filename = EXCLUDED.filename,
                    filepath = EXCLUDED.filepath,
                    error = EXCLUDED.error,
                    chunks_count = EXCLUDED.chunks_count,
                    ingested_at = EXCLUDED.ingested_at,
                    prefilter_stats = EXCLUDED.prefilter_stats,
                    image_stats = EXCLUDED.image_stats,
                    book_name = EXCLUDED.book_name,
                    book_status = EXCLUDED.book_status
                """,
                (
                    file_hash,
                    merged.get("status"),
                    merged.get("filename"),
                    merged.get("filepath"),
                    merged.get("error"),
                    int(merged.get("chunks_count") or 0),
                    merged.get("ingested_at"),
                    ps_json,
                    ims_json,
                    merged.get("book_name"),
                    merged.get("book_status"),
                ),
            )
        conn.commit()


def pdf_registry_count_total() -> int:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM rag_pdf_registry")
            row = cur.fetchone()
            return int(row["c"]) if row else 0


def pdf_registry_count_status(status: str) -> int:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS c FROM rag_pdf_registry WHERE status = %s", (status,))
            row = cur.fetchone()
            return int(row["c"]) if row else 0


def pdf_registry_find_failed(limit: int) -> list[dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT file_hash, filename, filepath, error
                FROM rag_pdf_registry
                WHERE status = 'failed'
                ORDER BY ingested_at DESC NULLS LAST
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
    return [
        {
            "_id": r["file_hash"],
            "filename": r.get("filename"),
            "filepath": r.get("filepath"),
            "error": r.get("error"),
        }
        for r in rows
    ]


def pdf_registry_find_recent(limit: int) -> list[dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT file_hash, filename, filepath, status, chunks_count, error, prefilter_stats, image_stats,
                       book_name, book_status, ingested_at
                FROM rag_pdf_registry
                ORDER BY ingested_at DESC NULLS LAST
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
    out = []
    for r in rows:
        ps = r.get("prefilter_stats")
        if isinstance(ps, str):
            try:
                ps = json.loads(ps)
            except json.JSONDecodeError:
                ps = None
        ims = r.get("image_stats")
        if isinstance(ims, str):
            try:
                ims = json.loads(ims)
            except json.JSONDecodeError:
                ims = None
        out.append(
            {
                "_id": r["file_hash"],
                "filename": r.get("filename"),
                "filepath": r.get("filepath"),
                "status": r.get("status"),
                "chunks_count": int(r.get("chunks_count") or 0),
                "error": r.get("error"),
                "prefilter_stats": ps,
                "image_stats": ims,
                "book_name": r.get("book_name"),
                "book_status": r.get("book_status"),
                "ingested_at": r.get("ingested_at"),
            }
        )
    return out


def pdf_registry_distinct_book_names(*, active_only: bool = True) -> list[str]:
    """Distinct logical book labels from registry (Marker ingest ``BookName``)."""
    active_sql = ""
    params: list[Any] = []
    if active_only:
        active_sql = (
            " AND (book_status IS NULL OR LOWER(BTRIM(COALESCE(book_status, ''))) <> %s)"
        )
        params.append("outdated")
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT DISTINCT BTRIM(book_name) AS bn
                FROM rag_pdf_registry
                WHERE book_name IS NOT NULL AND BTRIM(book_name) <> ''
                {active_sql}
                ORDER BY bn ASC
                """,
                params,
            )
            rows = cur.fetchall()
    return [str(r["bn"]).strip() for r in rows if r and r.get("bn")]


def education_top_key_topics(
    *,
    book_name: Optional[str] = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Most frequent section headings / chapter_topic labels in Marker text rows.
    Prefer ``section_heading`` when present (ingest extracts markdown titles).
    """
    lim = max(1, min(50, int(limit)))
    bn = str(book_name).strip() if book_name else None
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT COALESCE(
                    NULLIF(BTRIM(metadata->>'section_heading'), ''),
                    NULLIF(BTRIM(metadata->>'chapter_topic'), '')
                ) AS label,
                COUNT(*)::bigint AS cnt
                FROM rag_retrieval_items
                WHERE kind = 'text'
                  AND COALESCE(
                      NULLIF(BTRIM(metadata->>'section_heading'), ''),
                      NULLIF(BTRIM(metadata->>'chapter_topic'), '')
                  ) IS NOT NULL
                  AND BTRIM(COALESCE(
                      NULLIF(BTRIM(metadata->>'section_heading'), ''),
                      NULLIF(BTRIM(metadata->>'chapter_topic'), '')
                  )) <> ''
                  AND LOWER(BTRIM(COALESCE(
                      NULLIF(BTRIM(metadata->>'section_heading'), ''),
                      NULLIF(BTRIM(metadata->>'chapter_topic'), '')
                  ))) <> 'general'
                  AND (%s::text IS NULL OR BTRIM(COALESCE(metadata->>'book_name','')) = BTRIM(%s::text))
                GROUP BY label
                ORDER BY cnt DESC
                LIMIT %s
                """,
                (bn, bn, lim),
            )
            rows = cur.fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        lb = str(r.get("label") or "").strip()
        if not lb:
            continue
        out.append({"label": lb, "chunk_count": int(r.get("cnt") or 0)})
    return out


def _vector_literal(vec: list[float]) -> str:
    if len(vec) != EMBEDDING_DIMENSION:
        raise ValueError(f"embedding length {len(vec)} != EMBEDDING_DIMENSION {EMBEDDING_DIMENSION}")
    return "[" + ",".join(str(float(x)) for x in vec) + "]"


# ── Marker retrieval items (pgvector) ─────────────────────────────────────────


def retrieval_distinct_page_hints(file_hash: str) -> set[int]:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT page_hint FROM rag_retrieval_items WHERE file_hash = %s",
                (file_hash,),
            )
            return {
                int(r["page_hint"])
                for r in cur.fetchall()
                if r is not None and r.get("page_hint") is not None
            }


def retrieval_count_for_file_hash(file_hash: str) -> int:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS c FROM rag_retrieval_items WHERE file_hash = %s",
                (file_hash,),
            )
            row = cur.fetchone()
            return int(row["c"]) if row else 0


def retrieval_items_delete_for_file_hash(file_hash: str) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM rag_retrieval_items WHERE file_hash = %s", (file_hash,))
        conn.commit()


def retrieval_items_delete_for_file_hash_page_ranges(
    file_hash: str,
    ranges: list[tuple[int, int]],
) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            for p0, p1 in ranges:
                cur.execute(
                    """
                    DELETE FROM rag_retrieval_items
                    WHERE file_hash = %s AND page_hint >= %s AND page_hint <= %s
                    """,
                    (file_hash, int(p0), int(p1)),
                )
        conn.commit()


def retrieval_items_insert_many(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            for row in rows:
                vec_lit = _vector_literal(list(row.get("embedding") or []))
                cur.execute(
                    """
                    INSERT INTO rag_retrieval_items (
                        kind, file_hash, source_file, page_hint, chunk_key, content, embedding_text,
                        metadata, image_url, image_storage_key, embedding
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::vector)
                    ON CONFLICT (file_hash, chunk_key) DO UPDATE SET
                        content = EXCLUDED.content,
                        embedding_text = EXCLUDED.embedding_text,
                        metadata = EXCLUDED.metadata,
                        image_url = EXCLUDED.image_url,
                        image_storage_key = EXCLUDED.image_storage_key,
                        embedding = EXCLUDED.embedding
                    """,
                    (
                        row.get("kind"),
                        row.get("file_hash"),
                        row.get("source_file"),
                        int(row.get("page_hint") or 0),
                        row.get("chunk_key"),
                        row.get("content", ""),
                        row.get("embedding_text", ""),
                        Json(row.get("metadata") or {}),
                        row.get("image_url"),
                        row.get("image_storage_key"),
                        vec_lit,
                    ),
                )
        conn.commit()


def retrieval_vector_search(
    query_embedding: list[float],
    kind: str,
    top_k: int,
    chapter_topics: Optional[list[str]] = None,
    audience: Optional[str] = None,
    *,
    book_name: Optional[str] = None,
    include_outdated_books: bool = False,
) -> list[dict[str, Any]]:
    """Cosine distance on `embedding`; returns rows with similarity ≈ 1 - distance.

    ``audience`` is accepted for call-site compatibility but intentionally ignored:
    chunk ``metadata.audience`` reflects ingest-time filename heuristics, not who may
    retrieve the row—clinician vs patient tone is applied only in the LLM prompt.
    """
    del audience  # unused
    q_lit = _vector_literal(list(query_embedding))
    topics = [str(t).strip() for t in (chapter_topics or []) if str(t).strip()]
    params: list[Any] = [q_lit, str(kind)]
    topic_sql = ""
    if topics:
        topic_sql = (
            " AND (r.kind = 'image' OR (r.metadata->>'chapter_topic') IS NULL "
            " OR (r.metadata->>'chapter_topic') = 'general' "
            " OR (r.metadata->>'chapter_topic') = ANY(%s::text[]))"
        )
        params.append(topics)
    # See _match_extra_filters: do not filter vectors by chunk metadata audience.

    join_sql = " LEFT JOIN rag_pdf_registry reg ON reg.file_hash = r.file_hash "
    book_sql = ""
    bn = str(book_name or "").strip()
    if bn:
        book_sql += (
            " AND (reg.book_name IS NOT NULL AND BTRIM(reg.book_name) = BTRIM(%s))"
        )
        params.append(bn)
    if not include_outdated_books:
        book_sql += (
            " AND (reg.file_hash IS NULL OR reg.book_status IS NULL OR "
            "LOWER(BTRIM(COALESCE(reg.book_status, ''))) <> %s)"
        )
        params.append("outdated")

    sql = f"""
        WITH q AS (SELECT %s::vector AS v)
        SELECT r.chunk_key, r.content, r.source_file, r.page_hint, r.metadata, r.image_url,
               1 - (r.embedding <=> q.v) AS similarity,
               r.embedding <=> q.v AS distance
        FROM rag_retrieval_items r
        {join_sql}CROSS JOIN q
        WHERE r.kind = %s{topic_sql}{book_sql}
        ORDER BY r.embedding <=> (SELECT v FROM q)
        LIMIT %s
    """
    params.append(int(top_k))

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            raw_rows = cur.fetchall()

    out: list[dict[str, Any]] = []
    for row in raw_rows:
        meta = row.get("metadata")
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except json.JSONDecodeError:
                meta = {}
        if not isinstance(meta, dict):
            meta = {}
        out.append(
            {
                "chunk_key": row.get("chunk_key", ""),
                "content": row.get("content", ""),
                "source_file": row.get("source_file", ""),
                "page_hint": int(row.get("page_hint") or 0),
                "metadata": meta,
                "image_url": row.get("image_url"),
                "similarity": _float_score(row.get("similarity")),
                "distance": _float_score(row.get("distance")),
            }
        )
    return out


# ── Marker job queue ──────────────────────────────────────────────────────────


def marker_job_upsert_start(
    file_hash: str,
    filepath: str,
    filename: str,
    total_pages: int,
    batch_size: int,
    *,
    ingest_meta: Optional[dict[str, Any]] = None,
) -> int:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rag_marker_jobs (
                    file_hash, filepath, filename, total_pages, batch_size, status, ingest_meta
                )
                VALUES (%s, %s, %s, %s, %s, 'queued', %s)
                RETURNING id
                """,
                (file_hash, filepath, filename, int(total_pages), int(batch_size), Json(ingest_meta or {})),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("marker_job_upsert_start: INSERT returned no row")
            rid = int(row["id"])
        conn.commit()
    return rid


def marker_job_get_by_id(job_id: int) -> Optional[dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM rag_marker_jobs WHERE id = %s", (job_id,))
            row = cur.fetchone()
    if not row:
        return None
    return dict(row)


def marker_job_update(job_id: int, status: str, error: Optional[str] = None) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE rag_marker_jobs
                SET status = %s, error = %s, updated_at = (now() AT TIME ZONE 'utc')
                WHERE id = %s
                """,
                (status, error, job_id),
            )
        conn.commit()


def marker_batches_insert(job_id: int, ranges: list[tuple[int, int, int]]) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            for batch_index, page_start, page_end in ranges:
                cur.execute(
                    """
                    INSERT INTO rag_marker_batches (job_id, batch_index, page_start, page_end, status)
                    VALUES (%s, %s, %s, %s, 'queued')
                    """,
                    (job_id, int(batch_index), int(page_start), int(page_end)),
                )
        conn.commit()


def marker_batches_for_job(job_id: int) -> list[dict[str, Any]]:
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id, job_id, batch_index, page_start, page_end, status, error, marker_stats
                FROM rag_marker_batches
                WHERE job_id = %s
                ORDER BY batch_index ASC, id ASC
                """,
                (job_id,),
            )
            rows = cur.fetchall()
    return [dict(r) for r in rows]


def marker_batch_update(
    batch_id: int,
    status: str,
    error: Optional[str] = None,
    marker_stats: Optional[dict[str, Any]] = None,
) -> None:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE rag_marker_batches
                SET status = %s, error = %s, marker_stats = %s
                WHERE id = %s
                """,
                (status, error, Json(marker_stats) if marker_stats is not None else None, batch_id),
            )
        conn.commit()
