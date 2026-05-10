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
ALTER TABLE rag_chunks DROP COLUMN IF EXISTS images;

CREATE TABLE IF NOT EXISTS rag_pdf_registry (
    file_hash       TEXT PRIMARY KEY,
    status          TEXT NOT NULL,
    filename        TEXT,
    filepath        TEXT,
    error           TEXT,
    chunks_count    INT NOT NULL DEFAULT 0,
    ingested_at     TIMESTAMPTZ,
    prefilter_stats JSONB,
    image_stats     JSONB
);
ALTER TABLE rag_pdf_registry ADD COLUMN IF NOT EXISTS image_stats JSONB;

CREATE INDEX IF NOT EXISTS rag_pdf_registry_status_idx ON rag_pdf_registry (status);
CREATE INDEX IF NOT EXISTS rag_pdf_registry_ingested_at_idx ON rag_pdf_registry (ingested_at DESC);
CREATE INDEX IF NOT EXISTS rag_pdf_registry_status_ingested_idx ON rag_pdf_registry (status, ingested_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS rag_pdf_registry_filename_lower_idx ON rag_pdf_registry (lower(filename));
ALTER TABLE rag_pdf_registry ADD COLUMN IF NOT EXISTS book_name TEXT;
ALTER TABLE rag_pdf_registry ADD COLUMN IF NOT EXISTS book_status TEXT;
CREATE INDEX IF NOT EXISTS rag_pdf_registry_book_name_idx ON rag_pdf_registry (book_name);
CREATE INDEX IF NOT EXISTS rag_pdf_registry_book_status_idx ON rag_pdf_registry (book_status);

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
ALTER TABLE rag_query_cache DROP COLUMN IF EXISTS images;

-- pgvector (enable in Supabase: Database → Extensions → vector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Marker + embedding rows for semantic retrieval (separate from legacy rag_chunks FTS)
CREATE TABLE IF NOT EXISTS rag_retrieval_items (
    id                  BIGSERIAL PRIMARY KEY,
    kind                TEXT NOT NULL CHECK (kind IN ('text', 'image')),
    file_hash           TEXT NOT NULL,
    source_file         TEXT NOT NULL,
    page_hint           INT NOT NULL DEFAULT 0,
    chunk_key           TEXT NOT NULL,
    content             TEXT NOT NULL DEFAULT '',
    embedding_text      TEXT NOT NULL DEFAULT '',
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    image_url           TEXT,
    image_storage_key   TEXT,
    embedding           vector(1536) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    CONSTRAINT rag_retrieval_items_file_chunk UNIQUE (file_hash, chunk_key)
);

CREATE INDEX IF NOT EXISTS rag_retrieval_items_file_hash_idx ON rag_retrieval_items (file_hash);
CREATE INDEX IF NOT EXISTS rag_retrieval_items_kind_idx ON rag_retrieval_items (kind);
CREATE INDEX IF NOT EXISTS rag_retrieval_items_page_idx ON rag_retrieval_items (file_hash, page_hint);
CREATE INDEX IF NOT EXISTS rag_retrieval_items_embedding_hnsw_idx
    ON rag_retrieval_items USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS rag_retrieval_items_metadata_book_name_idx
    ON rag_retrieval_items ((metadata->>'book_name'));

CREATE TABLE IF NOT EXISTS rag_marker_jobs (
    id              BIGSERIAL PRIMARY KEY,
    file_hash       TEXT NOT NULL,
    filepath        TEXT NOT NULL,
    filename        TEXT NOT NULL,
    total_pages     INT NOT NULL,
    batch_size      INT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued',
    error           TEXT,
    ingest_meta     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS rag_marker_jobs_file_hash_idx ON rag_marker_jobs (file_hash);
CREATE INDEX IF NOT EXISTS rag_marker_jobs_status_idx ON rag_marker_jobs (status);

CREATE TABLE IF NOT EXISTS rag_marker_batches (
    id              BIGSERIAL PRIMARY KEY,
    job_id          BIGINT NOT NULL REFERENCES rag_marker_jobs (id) ON DELETE CASCADE,
    batch_index     INT NOT NULL,
    page_start      INT NOT NULL,
    page_end        INT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued',
    error           TEXT,
    marker_stats    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS rag_marker_batches_job_id_idx ON rag_marker_batches (job_id);

-- Alias views for tooling expecting `rag_ingest_*` names are created in Python (`_ensure_rag_ingest_alias_views`):
--   rag_ingest_jobs    → rag_marker_jobs
--   rag_ingest_batches → rag_marker_batches
-- (Plain SQL DROP VIEW IF EXISTS fails when the name is already a TABLE; we inspect pg_class.relkind in code.)
