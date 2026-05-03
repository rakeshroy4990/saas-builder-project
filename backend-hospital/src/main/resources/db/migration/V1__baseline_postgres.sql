-- Baseline schema for Mongo → PostgreSQL migration (Supabase-compatible).
-- No ddl-auto: all changes via new Flyway versions only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                    TEXT PRIMARY KEY,
    external_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    username              TEXT,
    email                 TEXT,
    first_name            TEXT,
    last_name             TEXT,
    password_hash         TEXT,
    address               TEXT,
    gender                TEXT,
    mobile_number         TEXT,
    department            TEXT,
    qualifications        TEXT,
    smc_name              TEXT,
    smc_registration_number TEXT,
    created_at            TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ,
    active                BOOLEAN NOT NULL DEFAULT true,
    token_version         BIGINT NOT NULL DEFAULT 1,
    role                  TEXT NOT NULL DEFAULT 'PATIENT',
    role_status           TEXT NOT NULL DEFAULT 'ACTIVE',
    requested_role        TEXT,
    role_requested_at     TIMESTAMPTZ,
    role_decision_at      TIMESTAMPTZ,
    role_decision_by      TEXT,
    role_rejected_reason  TEXT,
    deleted               BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_username_lower ON users (lower(username));
CREATE INDEX idx_users_role_role_status ON users (role, role_status);

-- ---------------------------------------------------------------------------
-- refresh_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id           TEXT PRIMARY KEY,
    token        TEXT NOT NULL UNIQUE,
    user_id      TEXT NOT NULL REFERENCES users (id),
    expiry       TIMESTAMPTZ NOT NULL,
    device_id    TEXT,
    created_at   TIMESTAMPTZ,
    deleted      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- medical_departments
-- ---------------------------------------------------------------------------
CREATE TABLE medical_departments (
    id            TEXT PRIMARY KEY,
    external_id   UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name          TEXT,
    code          TEXT NOT NULL,
    description   TEXT,
    active        BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ,
    deleted       BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX uq_medical_departments_code_lower ON medical_departments (lower(code));

-- ---------------------------------------------------------------------------
-- doctor_schedules
-- ---------------------------------------------------------------------------
CREATE TABLE doctor_schedules (
    id          TEXT PRIMARY KEY,
    external_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    doctor_id   TEXT NOT NULL UNIQUE REFERENCES users (id),
    weekly      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by  TEXT,
    updated_at  TIMESTAMPTZ,
    deleted     BOOLEAN NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
CREATE TABLE appointments (
    id                              TEXT PRIMARY KEY,
    external_id                     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_name                    TEXT,
    email                           TEXT,
    phone_number                    TEXT,
    age_group                       TEXT,
    department                      TEXT,
    doctor_id                       TEXT REFERENCES users (id),
    doctor_name                     TEXT,
    preferred_date                  TEXT,
    preferred_time_slot             TEXT,
    additional_notes                TEXT,
    status                          TEXT,
    prescription_files              JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at                      TIMESTAMPTZ,
    updated_at                      TIMESTAMPTZ,
    created_by                      TEXT,
    updated_by                      TEXT,
    appointment_email_notify_status TEXT,
    appointment_email_notify_failed BOOLEAN,
    appointment_email_notify_detail TEXT,
    appointment_email_notify_at     TIMESTAMPTZ,
    call_status                     TEXT,
    call_start_time                 TIMESTAMPTZ,
    call_end_time                   TIMESTAMPTZ,
    deleted                         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_appointments_doctor_id ON appointments (doctor_id);
CREATE INDEX idx_appointments_created_by ON appointments (created_by);
CREATE INDEX idx_appointments_preferred_date ON appointments (preferred_date);

-- ---------------------------------------------------------------------------
-- structured_prescriptions
-- ---------------------------------------------------------------------------
CREATE TABLE structured_prescriptions (
    id                       TEXT PRIMARY KEY,
    external_id              UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    appointment_id           TEXT NOT NULL UNIQUE REFERENCES appointments (id),
    prescriber_user_id       TEXT REFERENCES users (id),
    status                   TEXT NOT NULL DEFAULT 'DRAFT',
    template_version         TEXT,
    draft_payload            JSONB NOT NULL DEFAULT '{}'::jsonb,
    signed_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    pdf_bytes                BYTEA,
    pdf_bytes_cipher         BYTEA,
    draft_payload_cipher     BYTEA,
    signed_payload_cipher    BYTEA,
    pdf_sha256               TEXT,
    signed_at                TIMESTAMPTZ,
    signature_vendor         TEXT,
    signature_metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature_attestation_id TEXT,
    audit_log                JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at               TIMESTAMPTZ,
    updated_at               TIMESTAMPTZ,
    deleted                  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_structured_prescriptions_prescriber ON structured_prescriptions (prescriber_user_id);

-- ---------------------------------------------------------------------------
-- sent_emails
-- ---------------------------------------------------------------------------
CREATE TABLE sent_emails (
    id             TEXT PRIMARY KEY,
    external_id    UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    event          TEXT,
    email_body     TEXT,
    patient_id     TEXT,
    doctor_id      TEXT,
    created_at     TIMESTAMPTZ,
    deleted        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_sent_emails_patient ON sent_emails (patient_id);
CREATE INDEX idx_sent_emails_doctor ON sent_emails (doctor_id);
CREATE INDEX idx_sent_emails_event ON sent_emails (event);

-- ---------------------------------------------------------------------------
-- session_telemetry
-- ---------------------------------------------------------------------------
CREATE TABLE session_telemetry (
    id              TEXT PRIMARY KEY,
    external_id     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    session_key     TEXT,
    user_id         TEXT,
    trace_id        TEXT,
    started_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    total_events    INTEGER NOT NULL DEFAULT 0,
    event_counts    JSONB NOT NULL DEFAULT '{}'::jsonb,
    flow_counts     JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_event_name TEXT,
    last_flow       TEXT,
    last_status     TEXT,
    last_reason_code TEXT,
    last_http_status INTEGER,
    session_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    deleted         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_session_telemetry_session_key ON session_telemetry (session_key);
CREATE INDEX idx_session_telemetry_trace_id ON session_telemetry (trace_id);

-- ---------------------------------------------------------------------------
-- smart_ai_daily_usage
-- ---------------------------------------------------------------------------
CREATE TABLE smart_ai_daily_usage (
    id            TEXT PRIMARY KEY,
    request_count INTEGER NOT NULL DEFAULT 0,
    user_id       TEXT NOT NULL,
    utc_day       TEXT NOT NULL,
    updated_at    TIMESTAMPTZ,
    deleted       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_smart_ai_daily_usage_user_day ON smart_ai_daily_usage (user_id, utc_day);

-- ---------------------------------------------------------------------------
-- ui_metadata
-- ---------------------------------------------------------------------------
CREATE TABLE ui_metadata (
    id          TEXT PRIMARY KEY,
    body_json   TEXT,
    updated_at  TIMESTAMPTZ,
    deleted     BOOLEAN NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- youtube_query_cache (formerly Mongo collection query_cache in rag_db)
-- ---------------------------------------------------------------------------
CREATE TABLE youtube_query_cache (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    video_id       TEXT,
    video_title    TEXT,
    updated_at     TIMESTAMPTZ NOT NULL,
    deleted        BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (user_id, normalized_query)
);

CREATE INDEX idx_youtube_query_cache_user ON youtube_query_cache (user_id);

-- ---------------------------------------------------------------------------
-- Realtime: chat
-- ---------------------------------------------------------------------------
CREATE TABLE chat_rooms (
    id              TEXT PRIMARY KEY,
    participants    TEXT[] NOT NULL,
    next_sequence   BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    deleted         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_chat_rooms_participants ON chat_rooms USING gin (participants);

CREATE TABLE chat_messages (
    id                 TEXT PRIMARY KEY,
    room_id            TEXT NOT NULL REFERENCES chat_rooms (id),
    sequence_number    BIGINT NOT NULL,
    sender_id          TEXT NOT NULL,
    body               TEXT,
    client_message_id  TEXT,
    created_at         TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ,
    deleted            BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_chat_messages_room_seq ON chat_messages (room_id, sequence_number DESC);

CREATE TABLE chat_acks (
    id               TEXT PRIMARY KEY,
    room_id          TEXT NOT NULL,
    user_id          TEXT NOT NULL,
    up_to_sequence   BIGINT NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ,
    deleted          BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (room_id, user_id)
);

CREATE TABLE support_chat_requests (
    id                   TEXT PRIMARY KEY,
    requester_user_id    TEXT NOT NULL,
    assigned_agent_user_id TEXT,
    status               TEXT NOT NULL,
    created_at           TIMESTAMPTZ,
    updated_at           TIMESTAMPTZ,
    deleted              BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_support_chat_requests_status_created ON support_chat_requests (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- WebRTC call_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE call_sessions (
    call_id      TEXT PRIMARY KEY,
    initiator_id TEXT,
    receiver_id  TEXT,
    start_time   TIMESTAMPTZ,
    end_time     TIMESTAMPTZ,
    status       TEXT NOT NULL DEFAULT 'RINGING',
    ended_reason TEXT,
    expires_at   TIMESTAMPTZ,
    deleted      BOOLEAN NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------
CREATE TABLE audit_events (
    id               TEXT PRIMARY KEY,
    actor_user_id    TEXT,
    action           TEXT,
    resource_type    TEXT,
    resource_id      TEXT,
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,
    deleted          BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_audit_events_actor ON audit_events (actor_user_id);
CREATE INDEX idx_audit_events_created ON audit_events (created_at DESC);
