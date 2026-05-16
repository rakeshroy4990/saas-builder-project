-- Denormalized fields from extracted_data for list/filter (source of truth remains JSONB).
ALTER TABLE patient_prescriptions
    ADD COLUMN IF NOT EXISTS doctor_name TEXT,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS patient_name TEXT,
    ADD COLUMN IF NOT EXISTS patient_gender TEXT;

COMMENT ON COLUMN patient_prescriptions.doctor_name IS 'From extracted_data.doctor_name (or consultant).';
COMMENT ON COLUMN patient_prescriptions.department IS 'From extracted_data.department.';
COMMENT ON COLUMN patient_prescriptions.patient_name IS 'From extracted_data.patient_name.';
COMMENT ON COLUMN patient_prescriptions.patient_gender IS 'From extracted_data.patient_gender.';

UPDATE patient_prescriptions
SET doctor_name = NULLIF(
        TRIM(COALESCE(extracted_data->>'doctor_name', extracted_data->>'consultant', '')),
        ''
    ),
    department = NULLIF(TRIM(COALESCE(extracted_data->>'department', '')), ''),
    patient_name = NULLIF(TRIM(COALESCE(extracted_data->>'patient_name', '')), ''),
    patient_gender = NULLIF(TRIM(COALESCE(extracted_data->>'patient_gender', '')), '')
WHERE deleted = false
  AND extracted_data IS NOT NULL
  AND extracted_data <> '{}'::jsonb;
