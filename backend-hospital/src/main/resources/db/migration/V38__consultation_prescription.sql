-- AI Conversation: generated clinical prescription (Complaint / History / Diagnosis / Medicines / …)
ALTER TABLE consultation_transcript
    ADD COLUMN IF NOT EXISTS prescription_json JSONB NOT NULL DEFAULT '{}'::jsonb;
