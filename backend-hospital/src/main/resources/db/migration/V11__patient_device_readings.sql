CREATE TABLE patient_device_readings (
    id                BIGSERIAL PRIMARY KEY,
    external_id       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_user_id   TEXT NOT NULL REFERENCES users (id),
    device_key        VARCHAR(64) NOT NULL,
    device_name       VARCHAR(128),
    device_type       VARCHAR(32) NOT NULL,
    measurements      JSONB NOT NULL,
    raw_bytes         BYTEA,
    recorded_at       TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted           BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_patient_device_readings_patient ON patient_device_readings (patient_user_id)
    WHERE deleted = false;
