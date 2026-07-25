-- Periodic audio chunk uploads for AI Conversation (survive forgotten Stop).

ALTER TABLE consultation_audio
    ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0;
