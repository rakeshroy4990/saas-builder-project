-- Doctor uploads often had patient_user_id = doctor but doctor_id NULL; align with list/similarity filters.
UPDATE patient_prescriptions p
SET doctor_id = p.uploaded_by
WHERE p.doctor_id IS NULL
  AND p.uploaded_by IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = p.uploaded_by
        AND upper(u.role) = 'DOCTOR'
  );

UPDATE patient_prescriptions p
SET doctor_id = p.patient_user_id
WHERE p.doctor_id IS NULL
  AND p.patient_user_id IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = p.patient_user_id
        AND upper(u.role) = 'DOCTOR'
  );
