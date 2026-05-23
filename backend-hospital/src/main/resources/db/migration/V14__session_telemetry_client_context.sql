-- Client environment for session_telemetry (web browser or mobile app).
ALTER TABLE session_telemetry
    ADD COLUMN IF NOT EXISTS os TEXT,
    ADD COLUMN IF NOT EXISTS device_id TEXT,
    ADD COLUMN IF NOT EXISTS browser_or_app TEXT;

CREATE INDEX IF NOT EXISTS idx_session_telemetry_device_id
    ON session_telemetry (device_id)
    WHERE device_id IS NOT NULL AND deleted = false;
