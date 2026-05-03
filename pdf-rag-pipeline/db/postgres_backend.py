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

from config.settings import DATABASE_URL, PG_TEXT_SEARCH_MIN_SCORE

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


def ensure_postgres_schema() -> None:
    path = Path(__file__).resolve().parent / "postgres_schema.sql"
    with get_pool().connection() as conn:
        _run_ddl_file(conn, path)
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
            parts.append("(c.metadata->>'chapter_topic') = ANY(%s::text[])")
            params.append(list(topics))

    aud = match.get("metadata.audience")
    if aud in {"layman", "expert"}:
        parts.append("c.metadata->>'audience' = %s")
        params.append(aud)

    return (" AND " + " AND ".join(parts)) if parts else "", params


def chunks_text_search(
    match: dict[str, Any],
    candidate_limit: int,
    min_score: float,
    apply_score_filter: bool,
) -> list[dict[str, Any]]:
    """
    Return chunk dicts aligned with Mongo aggregate projection:
    text, source_file, page_num, tags, metadata, score
    """
    text_search = match["$text"]["$search"]
    extra_sql, extra_params = _match_extra_filters(match)
    threshold = max(float(min_score), float(PG_TEXT_SEARCH_MIN_SCORE))

    score_where = "rank_score >= %s" if apply_score_filter else "TRUE"
    inner_sql = f"""
        SELECT c.text, c.source_file, c.page_num, c.tags, c.metadata,
               ts_rank_cd(c.search_vector, qt.q) AS rank_score
        FROM rag_chunks c
        CROSS JOIN (SELECT plainto_tsquery('english', %s) AS q) qt
        WHERE c.search_vector @@ qt.q{extra_sql}
    """
    sql = f"""
        SELECT text, source_file, page_num, tags, metadata, rank_score AS score
        FROM ({inner_sql}) sub
        WHERE {score_where}
        ORDER BY rank_score DESC
        LIMIT %s
    """
    params: list[Any] = [text_search, *extra_params]
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
            return {str(r[0]) for r in cur.fetchall() if r and r[0]}


def pdf_registry_mark(file_hash: str, status: str, **kwargs: Any) -> None:
    """Upsert pdf row; NULL kwargs do not overwrite existing columns (Mongo $set partial semantics)."""
    filename = kwargs.get("filename")
    filepath = kwargs.get("filepath")
    error = kwargs.get("error")
    chunks_count = kwargs.get("chunks_count")
    ingested_at = kwargs.get("ingested_at")
    prefilter_stats = kwargs.get("prefilter_stats")
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
        if status == "processed" and ingested_at is None and merged.get("ingested_at") is None:
            merged["ingested_at"] = datetime.now(timezone.utc)

        ps = merged.get("prefilter_stats")
        ps_json = Json(ps) if isinstance(ps, dict) else Json({})

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO rag_pdf_registry (file_hash, status, filename, filepath, error, chunks_count, ingested_at, prefilter_stats)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (file_hash) DO UPDATE SET
                    status = EXCLUDED.status,
                    filename = EXCLUDED.filename,
                    filepath = EXCLUDED.filepath,
                    error = EXCLUDED.error,
                    chunks_count = EXCLUDED.chunks_count,
                    ingested_at = EXCLUDED.ingested_at,
                    prefilter_stats = EXCLUDED.prefilter_stats
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
                ),
            )
        conn.commit()


def pdf_registry_count_total() -> int:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM rag_pdf_registry")
            return int(cur.fetchone()[0])


def pdf_registry_count_status(status: str) -> int:
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM rag_pdf_registry WHERE status = %s", (status,))
            return int(cur.fetchone()[0])


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
                SELECT file_hash, filename, filepath, status, chunks_count, error, prefilter_stats, ingested_at
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
        out.append(
            {
                "_id": r["file_hash"],
                "filename": r.get("filename"),
                "filepath": r.get("filepath"),
                "status": r.get("status"),
                "chunks_count": int(r.get("chunks_count") or 0),
                "error": r.get("error"),
                "prefilter_stats": ps,
                "ingested_at": r.get("ingested_at"),
            }
        )
    return out
