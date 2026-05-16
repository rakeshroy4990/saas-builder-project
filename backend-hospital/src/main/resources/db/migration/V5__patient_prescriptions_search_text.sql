-- Column 2: clinician-facing search text (diagnosis + medicines + dosage + clinical notes only).
-- Column 3: embedding remains vector(1536), populated from search_text only (see PatientPrescriptionExtractionWorker).

ALTER TABLE patient_prescriptions
    ADD COLUMN IF NOT EXISTS search_text TEXT;

COMMENT ON COLUMN patient_prescriptions.extracted_data IS
    'Full structured extract (demographics, hospital, clinical fields, admin metadata).';
COMMENT ON COLUMN patient_prescriptions.search_text IS
    'Search-optimised clinical text for embeddings and similarity (diagnosis, medicines, dosage, clinical notes only).';
COMMENT ON COLUMN patient_prescriptions.embedding IS
    'OpenAI embedding of search_text only (vector 1536), not extracted_data.';
