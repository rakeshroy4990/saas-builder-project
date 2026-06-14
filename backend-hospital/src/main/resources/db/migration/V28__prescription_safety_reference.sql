-- Prescription safety: drug reference tables + validation results.
-- Reference data is admin-curated; validation runs after OCR extraction or e-Rx validate.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE drug_reference (
    id                      BIGSERIAL PRIMARY KEY,
    external_id             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    generic_name            TEXT NOT NULL UNIQUE,
    drug_class              TEXT,
    common_brand_names_india TEXT[] NOT NULL DEFAULT '{}',
    pediatric_approved      BOOLEAN NOT NULL DEFAULT true,
    notes                   TEXT,
    search_text             TEXT NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted                 BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_drug_reference_search_trgm ON drug_reference
    USING gin (search_text gin_trgm_ops)
    WHERE deleted = false;

CREATE TABLE drug_interactions (
    id                      BIGSERIAL PRIMARY KEY,
    external_id             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    drug_a_generic          TEXT NOT NULL REFERENCES drug_reference (generic_name),
    drug_b_generic          TEXT NOT NULL REFERENCES drug_reference (generic_name),
    severity                TEXT NOT NULL CHECK (severity IN ('contraindicated', 'major', 'moderate', 'minor')),
    mechanism               TEXT,
    clinical_effect         TEXT,
    management              TEXT,
    source                  TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted                 BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT drug_interactions_canonical_order CHECK (drug_a_generic < drug_b_generic),
    CONSTRAINT drug_interactions_pair_unique UNIQUE (drug_a_generic, drug_b_generic)
);

CREATE TABLE pediatric_dosage_reference (
    id                      BIGSERIAL PRIMARY KEY,
    external_id             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    generic_name            TEXT NOT NULL REFERENCES drug_reference (generic_name),
    route                   TEXT NOT NULL DEFAULT 'oral'
        CHECK (route IN ('oral', 'iv', 'im', 'topical', 'inhaled', 'rectal')),
    min_age_months          INTEGER NOT NULL DEFAULT 0,
    max_age_months          INTEGER NOT NULL DEFAULT 216,
    dose_per_kg_mg          NUMERIC(8, 3),
    dose_unit               TEXT NOT NULL DEFAULT 'mg',
    frequency_per_day_min   INTEGER,
    frequency_per_day_max   INTEGER,
    max_single_dose_mg      NUMERIC(8, 2),
    max_daily_dose_mg       NUMERIC(8, 2),
    source                  TEXT,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted                 BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_pediatric_dosage_lookup ON pediatric_dosage_reference (generic_name, route, min_age_months, max_age_months)
    WHERE deleted = false;

CREATE TABLE prescription_validations (
    id                                  BIGSERIAL PRIMARY KEY,
    external_id                         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    prescription_source                 TEXT NOT NULL CHECK (prescription_source IN ('patient_upload', 'structured_erx')),
    patient_prescription_external_id    UUID REFERENCES patient_prescriptions (external_id) ON DELETE CASCADE,
    structured_prescription_external_id UUID REFERENCES structured_prescriptions (external_id) ON DELETE CASCADE,
    child_profile_external_id           UUID REFERENCES child_profiles (external_id),
    child_weight_kg_used                NUMERIC(5, 2),
    weight_source                       TEXT CHECK (weight_source IN ('growth_records', 'not_available')),
    overall_risk_level                  TEXT NOT NULL DEFAULT 'none'
        CHECK (overall_risk_level IN ('none', 'low', 'moderate', 'high', 'critical')),
    interaction_findings                JSONB NOT NULL DEFAULT '[]'::jsonb,
    dosage_findings                     JSONB NOT NULL DEFAULT '[]'::jsonb,
    unrecognized_drugs                  TEXT[] NOT NULL DEFAULT '{}',
    llm_summary                         TEXT,
    reviewed_by_doctor                  BOOLEAN NOT NULL DEFAULT false,
    reviewed_at                         TIMESTAMPTZ,
    reviewed_by_user_id                 TEXT REFERENCES users (id),
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT prescription_validations_target_chk CHECK (
        (patient_prescription_external_id IS NOT NULL AND structured_prescription_external_id IS NULL)
        OR (patient_prescription_external_id IS NULL AND structured_prescription_external_id IS NOT NULL)
    )
);

CREATE INDEX idx_prescription_validations_patient_rx ON prescription_validations (patient_prescription_external_id)
    WHERE patient_prescription_external_id IS NOT NULL;
CREATE INDEX idx_prescription_validations_structured_rx ON prescription_validations (structured_prescription_external_id)
    WHERE structured_prescription_external_id IS NOT NULL;
CREATE INDEX idx_prescription_validations_child ON prescription_validations (child_profile_external_id);
CREATE INDEX idx_prescription_validations_risk ON prescription_validations (overall_risk_level, created_at DESC);
