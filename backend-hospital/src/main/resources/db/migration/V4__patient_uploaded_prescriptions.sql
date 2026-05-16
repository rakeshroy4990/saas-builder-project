-- Patient-uploaded prescription documents (separate from structured_prescriptions e-Rx).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE patient_prescription_groups (
    id                  TEXT PRIMARY KEY,
    external_id         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_user_id     TEXT NOT NULL REFERENCES users (id),
    label               TEXT,
    group_type          TEXT CHECK (group_type IN ('multi_page', 'diagnosis', 'chronic')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted             BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_patient_prescription_groups_patient ON patient_prescription_groups (patient_user_id)
    WHERE deleted = false;

CREATE TABLE patient_prescriptions (
    id                  TEXT PRIMARY KEY,
    external_id         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_user_id     TEXT NOT NULL REFERENCES users (id),
    appointment_id      TEXT REFERENCES appointments (id),
    uploaded_by         TEXT NOT NULL REFERENCES users (id),
    file_storage_path   TEXT NOT NULL,
    thumb_storage_path  TEXT,
    file_hash           TEXT NOT NULL,
    file_size_bytes     INT,
    mime_type           TEXT CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
    extracted_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding           vector(1536),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'verified', 'rejected')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted             BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT patient_prescriptions_file_hash_unique UNIQUE (file_hash)
);

CREATE INDEX idx_patient_prescriptions_patient ON patient_prescriptions (patient_user_id)
    WHERE deleted = false;
CREATE INDEX idx_patient_prescriptions_appointment ON patient_prescriptions (appointment_id)
    WHERE deleted = false;
CREATE INDEX idx_patient_prescriptions_external_id ON patient_prescriptions (external_id);
CREATE INDEX idx_patient_prescriptions_created_at ON patient_prescriptions (created_at DESC);

CREATE INDEX patient_prescriptions_embedding_idx
    ON patient_prescriptions
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE TABLE patient_prescription_group_items (
    prescription_id     TEXT NOT NULL REFERENCES patient_prescriptions (id) ON DELETE CASCADE,
    group_id            TEXT NOT NULL REFERENCES patient_prescription_groups (id) ON DELETE CASCADE,
    page_number         INT NOT NULL DEFAULT 1,
    is_primary          BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (prescription_id, group_id)
);
