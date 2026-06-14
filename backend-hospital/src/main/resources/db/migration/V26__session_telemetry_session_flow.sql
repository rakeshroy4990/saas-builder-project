-- Ordered UI/server steps derived from session_summary, plus error count for admin filtering.
ALTER TABLE session_telemetry
    ADD COLUMN IF NOT EXISTS session_flow JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS flow_error_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_session_telemetry_flow_errors
    ON session_telemetry (updated_at DESC)
    WHERE deleted = false AND flow_error_count > 0;
