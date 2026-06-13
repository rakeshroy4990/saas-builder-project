CREATE TABLE child_profiles (
    id                      BIGSERIAL PRIMARY KEY,
    external_id             UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_user_id         TEXT NOT NULL REFERENCES users (id),
    display_name            VARCHAR(128) NOT NULL,
    date_of_birth           DATE NOT NULL,
    sex                     VARCHAR(8) NOT NULL CHECK (sex IN ('male', 'female')),
    blood_group             VARCHAR(8),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted                 BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_child_profiles_patient ON child_profiles (patient_user_id)
    WHERE deleted = false;

CREATE TABLE growth_records (
    id                          BIGSERIAL PRIMARY KEY,
    external_id                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    child_profile_external_id   UUID NOT NULL REFERENCES child_profiles (external_id),
    recorded_at                 TIMESTAMPTZ NOT NULL,
    recorded_by_user_id         TEXT REFERENCES users (id),
    age_months_at_recording     NUMERIC(6,2) NOT NULL,
    height_cm                   NUMERIC(5,2),
    weight_kg                   NUMERIC(5,2),
    head_circumference_cm       NUMERIC(5,2),
    bmi                         NUMERIC(5,2),
    height_percentile           NUMERIC(5,2),
    weight_percentile           NUMERIC(5,2),
    bmi_percentile              NUMERIC(5,2),
    hc_percentile               NUMERIC(5,2),
    source                      VARCHAR(32) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'ble_scale', 'ble_imported', 'clinic')),
    appointment_external_id     UUID REFERENCES appointments (external_id),
    device_reading_external_id  UUID REFERENCES patient_device_readings (external_id),
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted                     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_growth_records_child_time ON growth_records (child_profile_external_id, recorded_at)
    WHERE deleted = false;

ALTER TABLE patient_device_readings
    ADD COLUMN child_profile_external_id UUID REFERENCES child_profiles (external_id),
    ADD COLUMN appointment_external_id UUID REFERENCES appointments (external_id),
    ADD COLUMN recorded_by_user_id TEXT REFERENCES users (id);

CREATE INDEX idx_pdr_child_time ON patient_device_readings (child_profile_external_id, recorded_at)
    WHERE deleted = false AND child_profile_external_id IS NOT NULL;
