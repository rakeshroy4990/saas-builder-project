-- Speed up admin crash searches (last_flow = 'crash' from mobile/web crash events).
CREATE INDEX IF NOT EXISTS idx_session_telemetry_crash_flow
    ON session_telemetry (updated_at DESC)
    WHERE deleted = false AND last_flow = 'crash';
