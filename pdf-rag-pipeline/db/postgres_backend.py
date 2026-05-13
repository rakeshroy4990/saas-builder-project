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

from psycopg import sql
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


def _normalize_embedding_type_name(type_name: str) -> str:
    return str(type_name or "").strip().lower()


def _target_embedding_type_name(dimension: Optional[int] = None) -> str:
    dim = EMBEDDING_DIMENSION if dimension is None else int(dimension)
    return f"halfvec({dim})"


def _parse_vector_dimension(type_name: str) -> Optional[int]:
    raw = str(type_name or "").strip().lower()
    match = re.fullmatch(r"(?:vector|halfvec)\((\d+)\)", raw)
    if not match:
        return None
    return int(match.group(1))


def _retrieval_items_embedding_column_type(conn) -> Optional[str]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT format_type(a.atttypid, a.atttypmod) AS embedding_type
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'rag_retrieval_items'
              AND a.attname = 'embedding'
              AND a.attnum > 0
              AND NOT a.attisdropped
            """
        )
        row = cur.fetchone()
    if not row:
        return None
    raw_type = _normalize_embedding_type_name(str(row.get("embedding_type") or ""))
    return raw_type or None


def _retrieval_items_embedding_column_dimension(conn) -> Optional[int]:
    raw_type = _retrieval_items_embedding_column_type(conn)
    if not raw_type:
        return None
    return _parse_vector_dimension(raw_type)


def _retrieval_items_row_count(conn) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT COUNT(*) AS c FROM rag_retrieval_items")
        row = cur.fetchone()
    return int(row["c"]) if row else 0


def _drop_retrieval_items_embedding_indexes(conn) -> None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'rag_retrieval_items'
              AND indexdef ILIKE '%embedding%'
            """
        )
        rows = cur.fetchall()

    for row in rows:
        index_name = str(row.get("indexname") or "").strip()
        if not index_name:
            continue
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("DROP INDEX IF EXISTS public.{}").format(
                    sql.Identifier(index_name)
                )
            )


def _ensure_retrieval_items_vector_index(conn, dimension: int) -> None:
    _drop_retrieval_items_embedding_indexes(conn)
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS rag_retrieval_items_embedding_hnsw_idx
                ON rag_retrieval_items USING hnsw (embedding halfvec_cosine_ops)
                WITH (m = 16, ef_construction = 128)
            """
        )


def _alter_retrieval_items_embedding_dimension(conn, new_dimension: int) -> None:
    _drop_retrieval_items_embedding_indexes(conn)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            ALTER TABLE rag_retrieval_items
              ALTER COLUMN embedding TYPE {_target_embedding_type_name(new_dimension)}
              USING embedding::{_target_embedding_type_name(new_dimension)}
            """
        )
    _ensure_retrieval_items_vector_index(conn, int(new_dimension))


def _ensure_retrieval_items_embedding_dimension(conn, *, fail_on_mismatch: bool) -> str:
    current_type = _retrieval_items_embedding_column_type(conn)
    target_type = _target_embedding_type_name()
    if current_type is None:
        return target_type
    if current_type == target_type:
        return current_type

    row_count = _retrieval_items_row_count(conn)
    if row_count == 0:
        LOG.warning(
            "Updating rag_retrieval_items.embedding from %s to %s on empty table",
            current_type,
            target_type,
        )
        _alter_retrieval_items_embedding_dimension(conn, EMBEDDING_DIMENSION)
        return target_type

    message = (
        "Configured EMBEDDING_DIMENSION=%s and target type %s but rag_retrieval_items.embedding is %s "
        "with %s stored rows. Existing vectors must be purged and re-embedded before switching "
        "dimensions. Delete Marker retrieval rows for the affected books (or clear "
        "rag_retrieval_items), restart so the empty-table migration can resize the column, "
        "then re-run Marker ingest."
    ) % (EMBEDDING_DIMENSION, target_type, current_type, row_count)
    if fail_on_mismatch:
        raise RuntimeError(message)
    LOG.warning(message)
    return current_type


def ensure_postgres_schema() -> None:
    path = Path(__file__).resolve().parent / "postgres_schema.sql"
    with get_pool().connection() as conn:
        # Drop the old index BEFORE running schema.sql so it can't be
        # recreated with vector_cosine_ops and block the ALTER COLUMN below
        with conn.cursor() as cur:
            cur.execute("DROP INDEX IF EXISTS rag_retrieval_items_embedding_hnsw_idx")

        _run_ddl_file(conn, path)
        _ensure_rag_ingest_alias_views(conn)
        final_type = _ensure_retrieval_items_embedding_dimension(conn, fail_on_mismatch=False)
        if final_type == _target_embedding_type_name():
            _ensure_retrieval_items_vector_index(conn, EMBEDDING_DIMENSION)
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


def pdf_registry_ingested_book_pdf_rows() -> list[dict[str, Any]]:
    """List ingested BookName / PdfName pairs from successfully processed registry rows."""
    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT
                    BTRIM(book_name) AS book_name,
                    BTRIM(filename) AS pdf_name
                FROM rag_pdf_registry
                WHERE status = 'processed'
                  AND book_name IS NOT NULL
                  AND BTRIM(book_name) <> ''
                  AND filename IS NOT NULL
                  AND BTRIM(filename) <> ''
                ORDER BY BTRIM(book_name) ASC, BTRIM(filename) ASC
                """
            )
            rows = cur.fetchall()
    return [
        {
            "book_name": str(r.get("book_name") or "").strip(),
            "pdf_name": str(r.get("pdf_name") or "").strip(),
        }
        for r in rows
        if r and str(r.get("book_name") or "").strip() and str(r.get("pdf_name") or "").strip()
    ]


def purge_marker_book_data(book_name: str) -> dict[str, Any]:
    """
    Delete Marker/ingest DB artifacts for a logical book label.

    Removes rows from:
    - rag_chunks
    - rag_retrieval_items
    - rag_marker_jobs (rag_marker_batches cascade)
    - rag_pdf_registry

    Storage objects are removed by the API layer after this function returns the file hashes.
    """
    bn = str(book_name or "").strip()
    if not bn:
        raise ValueError("book_name is required")

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT DISTINCT file_hash
                FROM rag_pdf_registry
                WHERE book_name IS NOT NULL AND BTRIM(book_name) = BTRIM(%s)
                ORDER BY file_hash ASC
                """,
                (bn,),
            )
            registry_file_hashes = [str(r["file_hash"]) for r in cur.fetchall() if r and r.get("file_hash")]

            cur.execute(
                """
                SELECT DISTINCT id, file_hash
                FROM rag_marker_jobs
                WHERE BTRIM(COALESCE(ingest_meta->>'book_name', '')) = BTRIM(%s)
                """,
                (bn,),
            )
            jobs_by_book = cur.fetchall()
            file_hashes = sorted(
                {
                    *registry_file_hashes,
                    *[str(r["file_hash"]) for r in jobs_by_book if r and r.get("file_hash")],
                }
            )

            job_ids: list[int] = []
            if file_hashes:
                cur.execute(
                    """
                    SELECT DISTINCT id
                    FROM rag_marker_jobs
                    WHERE file_hash = ANY(%s::text[])
                       OR BTRIM(COALESCE(ingest_meta->>'book_name', '')) = BTRIM(%s)
                    ORDER BY id ASC
                    """,
                    (file_hashes, bn),
                )
            else:
                cur.execute(
                    """
                    SELECT DISTINCT id
                    FROM rag_marker_jobs
                    WHERE BTRIM(COALESCE(ingest_meta->>'book_name', '')) = BTRIM(%s)
                    ORDER BY id ASC
                    """,
                    (bn,),
                )
            job_ids = [int(r["id"]) for r in cur.fetchall() if r and r.get("id") is not None]

            marker_batches_deleted = 0
            if job_ids:
                cur.execute(
                    "SELECT COUNT(*) AS c FROM rag_marker_batches WHERE job_id = ANY(%s::bigint[])",
                    (job_ids,),
                )
                row = cur.fetchone()
                marker_batches_deleted = int(row["c"]) if row else 0

            rag_chunks_deleted = 0
            retrieval_items_deleted = 0
            registry_rows_deleted = 0
            if file_hashes:
                cur.execute("DELETE FROM rag_chunks WHERE file_hash = ANY(%s::text[])", (file_hashes,))
                rag_chunks_deleted = cur.rowcount or 0

                cur.execute("DELETE FROM rag_retrieval_items WHERE file_hash = ANY(%s::text[])", (file_hashes,))
                retrieval_items_deleted = cur.rowcount or 0

                cur.execute("DELETE FROM rag_pdf_registry WHERE file_hash = ANY(%s::text[])", (file_hashes,))
                registry_rows_deleted = cur.rowcount or 0

            marker_jobs_deleted = 0
            if job_ids:
                cur.execute("DELETE FROM rag_marker_jobs WHERE id = ANY(%s::bigint[])", (job_ids,))
                marker_jobs_deleted = cur.rowcount or 0

        conn.commit()

    return {
        "book_name": bn,
        "file_hashes": file_hashes,
        "files_matched": len(file_hashes),
        "rag_chunks_deleted": int(rag_chunks_deleted),
        "retrieval_items_deleted": int(retrieval_items_deleted),
        "marker_jobs_deleted": int(marker_jobs_deleted),
        "marker_batches_deleted": int(marker_batches_deleted),
        "registry_rows_deleted": int(registry_rows_deleted),
    }


def marker_book_info(book_name: str) -> dict[str, Any]:
    """
    Fetch an admin-friendly summary of all known ingest artifacts for one logical book label.

    Includes:
    - registry rows (`rag_pdf_registry`)
    - chunk / retrieval counts
    - marker jobs and batches
    - top key topics for the book
    """
    bn = str(book_name or "").strip()
    if not bn:
        raise ValueError("book_name is required")

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT file_hash, filename, filepath, status, chunks_count, error,
                       prefilter_stats, image_stats, book_name, book_status, ingested_at
                FROM rag_pdf_registry
                WHERE book_name IS NOT NULL AND BTRIM(book_name) = BTRIM(%s)
                ORDER BY ingested_at DESC NULLS LAST, filename ASC, file_hash ASC
                """,
                (bn,),
            )
            registry_rows = [dict(r) for r in cur.fetchall()]
            file_hashes = [str(r["file_hash"]) for r in registry_rows if r and r.get("file_hash")]

            total_chunks = 0
            retrieval_items_total = 0
            retrieval_text_items = 0
            retrieval_image_items = 0
            if file_hashes:
                cur.execute(
                    "SELECT COUNT(*) AS c FROM rag_chunks WHERE file_hash = ANY(%s::text[])",
                    (file_hashes,),
                )
                row = cur.fetchone()
                total_chunks = int(row["c"]) if row else 0

                cur.execute(
                    """
                    SELECT kind, COUNT(*)::bigint AS c
                    FROM rag_retrieval_items
                    WHERE file_hash = ANY(%s::text[])
                    GROUP BY kind
                    """,
                    (file_hashes,),
                )
                for row in cur.fetchall():
                    kind = str(row.get("kind") or "").strip().lower()
                    count = int(row.get("c") or 0)
                    retrieval_items_total += count
                    if kind == "text":
                        retrieval_text_items += count
                    elif kind == "image":
                        retrieval_image_items += count

            if file_hashes:
                cur.execute(
                    """
                    SELECT id, file_hash, filepath, filename, total_pages, batch_size, status, error,
                           ingest_meta, created_at, updated_at
                    FROM rag_marker_jobs
                    WHERE file_hash = ANY(%s::text[])
                       OR BTRIM(COALESCE(ingest_meta->>'book_name', '')) = BTRIM(%s)
                    ORDER BY created_at DESC NULLS LAST, id DESC
                    """,
                    (file_hashes, bn),
                )
            else:
                cur.execute(
                    """
                    SELECT id, file_hash, filepath, filename, total_pages, batch_size, status, error,
                           ingest_meta, created_at, updated_at
                    FROM rag_marker_jobs
                    WHERE BTRIM(COALESCE(ingest_meta->>'book_name', '')) = BTRIM(%s)
                    ORDER BY created_at DESC NULLS LAST, id DESC
                    """,
                    (bn,),
                )
            raw_jobs = [dict(r) for r in cur.fetchall()]
            job_ids = [int(r["id"]) for r in raw_jobs if r and r.get("id") is not None]

            batches_by_job: dict[int, list[dict[str, Any]]] = {}
            marker_batches_total = 0
            if job_ids:
                cur.execute(
                    """
                    SELECT id, job_id, batch_index, page_start, page_end, status, error, marker_stats, created_at
                    FROM rag_marker_batches
                    WHERE job_id = ANY(%s::bigint[])
                    ORDER BY job_id ASC, batch_index ASC, id ASC
                    """,
                    (job_ids,),
                )
                for row in cur.fetchall():
                    batch = dict(row)
                    job_id = int(batch.get("job_id") or 0)
                    batches_by_job.setdefault(job_id, []).append(
                        {
                            "batch_id": int(batch.get("id") or 0),
                            "batch_index": int(batch.get("batch_index") or 0),
                            "page_start": int(batch.get("page_start") or 0),
                            "page_end": int(batch.get("page_end") or 0),
                            "status": str(batch.get("status") or ""),
                            "error": str(batch.get("error") or ""),
                            "marker_stats": batch.get("marker_stats") if isinstance(batch.get("marker_stats"), dict) else {},
                            "created_at": batch.get("created_at"),
                        }
                    )
                    marker_batches_total += 1

    jobs: list[dict[str, Any]] = []
    for row in raw_jobs:
        ingest_meta = row.get("ingest_meta")
        if not isinstance(ingest_meta, dict):
            ingest_meta = {}
        jobs.append(
            {
                "job_id": int(row.get("id") or 0),
                "file_hash": str(row.get("file_hash") or ""),
                "filepath": str(row.get("filepath") or ""),
                "filename": str(row.get("filename") or ""),
                "total_pages": int(row.get("total_pages") or 0),
                "batch_size": int(row.get("batch_size") or 0),
                "status": str(row.get("status") or ""),
                "error": str(row.get("error") or ""),
                "ingest_meta": ingest_meta,
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
                "batches": batches_by_job.get(int(row.get("id") or 0), []),
            }
        )

    normalized_registry_rows: list[dict[str, Any]] = []
    for row in registry_rows:
        prefilter_stats = row.get("prefilter_stats")
        if not isinstance(prefilter_stats, dict):
            prefilter_stats = {}
        image_stats = row.get("image_stats")
        if not isinstance(image_stats, dict):
            image_stats = {}
        normalized_registry_rows.append(
            {
                "file_hash": str(row.get("file_hash") or ""),
                "filename": str(row.get("filename") or ""),
                "filepath": str(row.get("filepath") or ""),
                "status": str(row.get("status") or ""),
                "book_status": str(row.get("book_status") or "") or None,
                "chunks_count": int(row.get("chunks_count") or 0),
                "error": str(row.get("error") or ""),
                "ingested_at": row.get("ingested_at"),
                "prefilter_stats": prefilter_stats,
                "image_stats": image_stats,
            }
        )

    return {
        "book_name": bn,
        "files_matched": len(file_hashes),
        "file_hashes": file_hashes,
        "total_chunks": int(total_chunks),
        "retrieval_items_total": int(retrieval_items_total),
        "retrieval_text_items": int(retrieval_text_items),
        "retrieval_image_items": int(retrieval_image_items),
        "marker_jobs_total": len(jobs),
        "marker_batches_total": int(marker_batches_total),
        "registry_rows": normalized_registry_rows,
        "jobs": jobs,
        "key_topics": education_top_key_topics(book_name=bn, limit=20),
    }


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
        _ensure_retrieval_items_embedding_dimension(conn, fail_on_mismatch=True)
        with conn.cursor() as cur:
            for row in rows:
                vec_lit = _vector_literal(list(row.get("embedding") or []))
                cur.execute(
                    f"""
                    INSERT INTO rag_retrieval_items (
                        kind, file_hash, source_file, page_hint, chunk_key, content, embedding_text,
                        metadata, image_url, image_storage_key, embedding
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::{_target_embedding_type_name()})
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
        WITH q AS (SELECT %s::{_target_embedding_type_name()} AS v)
        SELECT r.file_hash, r.chunk_key, r.content, r.source_file, r.page_hint, r.metadata, r.image_url,
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
        _ensure_retrieval_items_embedding_dimension(conn, fail_on_mismatch=True)
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
                "file_hash": row.get("file_hash", ""),
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


def retrieval_images_near_file_pages(
    anchors: list[tuple[str, int]],
    *,
    page_window: int,
    limit: int,
) -> list[dict[str, Any]]:
    """
    Fetch image rows that live near already-selected text pages.

    This avoids relying on ANN ranking for figures whose captions are generic and lets
    query-time image selection follow the text context the LLM actually used.
    """
    grouped: dict[str, set[int]] = {}
    for file_hash, page_hint in anchors:
        fh = str(file_hash or "").strip()
        if not fh:
            continue
        grouped.setdefault(fh, set()).add(int(page_hint or 0))
    if not grouped:
        return []

    win = max(0, int(page_window))
    lim = max(1, int(limit))
    where_parts: list[str] = []
    params: list[Any] = []
    for fh, pages in grouped.items():
        for ph in sorted(pages):
            where_parts.append("(file_hash = %s AND page_hint BETWEEN %s AND %s)")
            params.extend([fh, ph - win, ph + win])
    sql = f"""
        SELECT file_hash, chunk_key, content, source_file, page_hint, metadata, image_url
        FROM rag_retrieval_items
        WHERE kind = 'image' AND ({' OR '.join(where_parts)})
    """

    with get_pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            raw_rows = cur.fetchall()

    def nearest_anchor_distance(file_hash: str, page_hint: int) -> int:
        pages = grouped.get(file_hash) or {0}
        return min(abs(page_hint - p) for p in pages)

    deduped: dict[str, dict[str, Any]] = {}
    for row in raw_rows:
        meta = row.get("metadata")
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except json.JSONDecodeError:
                meta = {}
        if not isinstance(meta, dict):
            meta = {}
        file_hash = str(row.get("file_hash") or "").strip()
        chunk_key = str(row.get("chunk_key") or "").strip()
        image_url = str(row.get("image_url") or "").strip()
        dedupe_key = image_url or f"{file_hash}:{chunk_key}"
        entry = {
            "file_hash": file_hash,
            "chunk_key": chunk_key,
            "content": row.get("content", ""),
            "source_file": row.get("source_file", ""),
            "page_hint": int(row.get("page_hint") or 0),
            "metadata": meta,
            "image_url": image_url,
        }
        prev = deduped.get(dedupe_key)
        if prev is None:
            deduped[dedupe_key] = entry
            continue
        if nearest_anchor_distance(file_hash, entry["page_hint"]) < nearest_anchor_distance(
            str(prev.get("file_hash") or ""),
            int(prev.get("page_hint") or 0),
        ):
            deduped[dedupe_key] = entry

    rows = list(deduped.values())
    rows.sort(
        key=lambda row: (
            nearest_anchor_distance(str(row.get("file_hash") or ""), int(row.get("page_hint") or 0)),
            int(row.get("page_hint") or 0),
            str(row.get("chunk_key") or ""),
        )
    )
    return rows[:lim]


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
