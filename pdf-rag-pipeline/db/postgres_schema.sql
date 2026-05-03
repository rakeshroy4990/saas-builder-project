-- PDF RAG pipeline tables (PostgreSQL). Apply once per database (also run from ensure_postgres_schema on startup).

CREATE TABLE IF NOT EXISTS rag_chunks (
    id              BIGSERIAL PRIMARY KEY,
    text            TEXT NOT NULL,
    source_file     TEXT NOT NULL,
    file_hash       TEXT,
    page_num        INT NOT NULL DEFAULT 0,
    chunk_index     INT NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags            JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    search_vector   tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(text, ''))) STORED
);

CREATE INDEX IF NOT EXISTS rag_chunks_search_vector_idx ON rag_chunks USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS rag_chunks_source_file_idx ON rag_chunks (source_file);
CREATE INDEX IF NOT EXISTS rag_chunks_file_hash_idx ON rag_chunks (file_hash);
-- Chunk filters combined with FTS (see postgres_backend._match_extra_filters)
CREATE INDEX IF NOT EXISTS rag_chunks_metadata_audience_idx ON rag_chunks ((metadata->>'audience'));
CREATE INDEX IF NOT EXISTS rag_chunks_metadata_chapter_topic_idx ON rag_chunks ((metadata->>'chapter_topic'));
CREATE INDEX IF NOT EXISTS rag_chunks_file_hash_page_idx ON rag_chunks (file_hash, page_num, chunk_index);

CREATE TABLE IF NOT EXISTS rag_pdf_registry (
    file_hash       TEXT PRIMARY KEY,
    status          TEXT NOT NULL,
    filename        TEXT,
    filepath        TEXT,
    error           TEXT,
    chunks_count    INT NOT NULL DEFAULT 0,
    ingested_at     TIMESTAMPTZ,
    prefilter_stats JSONB
);

CREATE INDEX IF NOT EXISTS rag_pdf_registry_status_idx ON rag_pdf_registry (status);
CREATE INDEX IF NOT EXISTS rag_pdf_registry_ingested_at_idx ON rag_pdf_registry (ingested_at DESC);
CREATE INDEX IF NOT EXISTS rag_pdf_registry_status_ingested_idx ON rag_pdf_registry (status, ingested_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS rag_pdf_registry_filename_lower_idx ON rag_pdf_registry (lower(filename));

CREATE TABLE IF NOT EXISTS rag_query_cache (
    id                   TEXT PRIMARY KEY,
    query                TEXT NOT NULL DEFAULT '',
    audience             TEXT NOT NULL DEFAULT '',
    user_id              TEXT NOT NULL DEFAULT '',
    answer               TEXT NOT NULL DEFAULT '',
    follow_up_questions  JSONB NOT NULL DEFAULT '[]'::jsonb,
    cached_at            TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    expires_at           TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS rag_query_cache_expires_at_idx ON rag_query_cache (expires_at);
CREATE INDEX IF NOT EXISTS rag_query_cache_user_cached_idx ON rag_query_cache (user_id, cached_at DESC);
CREATE INDEX IF NOT EXISTS rag_query_cache_audience_idx ON rag_query_cache (audience);
