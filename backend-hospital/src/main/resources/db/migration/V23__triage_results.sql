CREATE TABLE triage_results (
    id                      BIGSERIAL PRIMARY KEY,
    external_id             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    appointment_external_id UUID REFERENCES appointments (external_id),
    patient_user_id         TEXT NOT NULL REFERENCES users (id),
    child_display_name      TEXT,
    child_age_months        INTEGER NOT NULL,
    child_weight_kg         NUMERIC(5,2),
    reported_symptoms       TEXT[] NOT NULL,
    symptom_duration_hours  INTEGER,
    symptom_severity        TEXT NOT NULL
        CHECK (symptom_severity IN ('MILD','MODERATE','SEVERE')),
    additional_notes        TEXT,
    urgency_level           TEXT NOT NULL
        CHECK (urgency_level IN ('HOME_CARE','CLINIC_VISIT','EMERGENCY')),
    urgency_reasoning       TEXT NOT NULL,
    doctor_note             TEXT NOT NULL,
    red_flags               TEXT[] NOT NULL DEFAULT '{}',
    confidence              TEXT CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
    model_used              TEXT,
    rag_chunks_used         JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted                 BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_triage_results_appointment ON triage_results (appointment_external_id)
    WHERE deleted = false;
CREATE INDEX idx_triage_results_patient ON triage_results (patient_user_id)
    WHERE deleted = false;
CREATE INDEX idx_triage_results_patient_created ON triage_results (patient_user_id, created_at DESC)
    WHERE deleted = false;
