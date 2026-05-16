-- Align with pdf-rag-pipeline: text-embedding-3-large @ 3072 dimensions (halfvec + HNSW).
DROP INDEX IF EXISTS patient_prescriptions_embedding_idx;

ALTER TABLE patient_prescriptions
    ALTER COLUMN embedding TYPE halfvec(3072)
    USING NULL;

COMMENT ON COLUMN patient_prescriptions.embedding IS
    'OpenAI text-embedding-3-large (3072-dim halfvec) of search_text; same model/dim as pdf-rag-pipeline.';

CREATE INDEX IF NOT EXISTS patient_prescriptions_embedding_hnsw_idx
    ON patient_prescriptions
    USING hnsw (embedding halfvec_cosine_ops);
