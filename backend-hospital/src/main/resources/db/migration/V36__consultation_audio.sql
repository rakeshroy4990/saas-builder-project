-- AI Conversation: consultation audio + transcript drafts/commits (doctor-only clinical assist).

CREATE TABLE IF NOT EXISTS consultation_audio (
    id                      BIGSERIAL PRIMARY KEY,
    external_id             UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    appointment_external_id UUID         NOT NULL,
    doctor_user_id          TEXT         NOT NULL,
    patient_user_id         TEXT         NOT NULL,
    audio_storage_path      TEXT,
    duration_seconds        INTEGER,
    language_detected       TEXT,
    language_hint           TEXT,
    consent_acknowledged    BOOLEAN      NOT NULL DEFAULT false,
    status                  TEXT         NOT NULL DEFAULT 'STARTED',
    committed               BOOLEAN      NOT NULL DEFAULT false,
    deleted                 BOOLEAN      NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_audio_appointment
    ON consultation_audio (appointment_external_id)
    WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_consultation_audio_doctor
    ON consultation_audio (doctor_user_id)
    WHERE deleted = false;

CREATE TABLE IF NOT EXISTS consultation_transcript (
    id                              BIGSERIAL PRIMARY KEY,
    external_id                     UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    consultation_audio_external_id  UUID         NOT NULL REFERENCES consultation_audio (external_id),
    appointment_external_id         UUID         NOT NULL,
    transcript_json                 JSONB,
    transcript_text                 TEXT,
    structured_json                 JSONB,
    summary_json                    JSONB,
    soap_json                       JSONB,
    speakers_swapped                BOOLEAN      NOT NULL DEFAULT false,
    committed                       BOOLEAN      NOT NULL DEFAULT false,
    deleted                         BOOLEAN      NOT NULL DEFAULT false,
    created_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_transcript_appointment
    ON consultation_transcript (appointment_external_id)
    WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_consultation_transcript_audio
    ON consultation_transcript (consultation_audio_external_id)
    WHERE deleted = false;
