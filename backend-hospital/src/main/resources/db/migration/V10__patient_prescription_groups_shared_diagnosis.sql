-- Shared clinical diagnosis for prescription groups (group_type = diagnosis).
ALTER TABLE patient_prescription_groups
    ADD COLUMN IF NOT EXISTS shared_diagnosis TEXT;

COMMENT ON COLUMN patient_prescription_groups.shared_diagnosis IS
    'Canonical diagnosis for diagnosis-type groups; multiple prescriptions link to this group.';
