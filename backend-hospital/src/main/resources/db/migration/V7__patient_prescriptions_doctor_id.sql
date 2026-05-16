-- Link patient-uploaded prescriptions to the treating doctor (users.id).
ALTER TABLE patient_prescriptions
    ADD COLUMN IF NOT EXISTS doctor_id TEXT REFERENCES users (id);

CREATE INDEX IF NOT EXISTS idx_patient_prescriptions_doctor
    ON patient_prescriptions (doctor_id)
    WHERE deleted = false AND doctor_id IS NOT NULL;

COMMENT ON COLUMN patient_prescriptions.doctor_id IS
    'Treating doctor (users.id); doctors list prescriptions where doctor_id matches their login.';

-- Backfill from linked appointments where possible.
UPDATE patient_prescriptions p
SET doctor_id = a.doctor_id
FROM appointments a
WHERE p.appointment_id = a.id
  AND p.doctor_id IS NULL
  AND a.doctor_id IS NOT NULL
  AND p.deleted = false;
