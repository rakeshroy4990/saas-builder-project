-- Indexes for common GET / list / lookup paths (business keys, filters, ordering).
-- Partial indexes use the same predicates as typical application queries (e.g. deleted = false).

-- users: role / status / active filters + department matching (see UserJpaRepository native queries)
CREATE INDEX idx_users_role_alive ON users (role, role_status, deleted, active)
    WHERE deleted = false;
CREATE INDEX idx_users_department_norm ON users (lower(trim(coalesce(department, ''))))
    WHERE deleted = false;
CREATE INDEX idx_users_mobile ON users (mobile_number)
    WHERE deleted = false AND mobile_number IS NOT NULL AND btrim(mobile_number) <> '';

-- refresh_tokens: lookups by user while excluding soft-deleted rows
CREATE INDEX idx_refresh_tokens_user_alive ON refresh_tokens (user_id, expiry DESC)
    WHERE deleted = false;

-- appointments: status boards, doctor queues, contact lookup
CREATE INDEX idx_appointments_status ON appointments (status)
    WHERE deleted = false;
CREATE INDEX idx_appointments_doctor_status ON appointments (doctor_id, status)
    WHERE deleted = false AND doctor_id IS NOT NULL;
CREATE INDEX idx_appointments_email_lower ON appointments (lower(email))
    WHERE deleted = false AND email IS NOT NULL AND btrim(email) <> '';
CREATE INDEX idx_appointments_phone ON appointments (phone_number)
    WHERE deleted = false AND phone_number IS NOT NULL AND btrim(phone_number) <> '';
CREATE INDEX idx_appointments_department ON appointments (department)
    WHERE deleted = false AND department IS NOT NULL AND btrim(department) <> '';
CREATE INDEX idx_appointments_created_at ON appointments (created_at DESC)
    WHERE deleted = false;

-- medical_departments: name search / listing
CREATE INDEX idx_medical_departments_name_lower ON medical_departments (lower(name))
    WHERE deleted = false AND name IS NOT NULL;
CREATE INDEX idx_medical_departments_active ON medical_departments (active)
    WHERE deleted = false;

-- structured_prescriptions: workflow by status
CREATE INDEX idx_structured_prescriptions_status ON structured_prescriptions (status)
    WHERE deleted = false;

-- sent_emails: timelines and correlation
CREATE INDEX idx_sent_emails_created_at ON sent_emails (created_at DESC)
    WHERE deleted = false;

-- session_telemetry: sessions by user
CREATE INDEX idx_session_telemetry_user_started ON session_telemetry (user_id, started_at DESC)
    WHERE deleted = false AND user_id IS NOT NULL AND btrim(user_id) <> '';

-- youtube_query_cache: list recent per user (replaces single-column user index)
DROP INDEX IF EXISTS idx_youtube_query_cache_user;
CREATE INDEX idx_youtube_query_cache_user_updated ON youtube_query_cache (user_id, updated_at DESC)
    WHERE deleted = false;
CREATE INDEX idx_youtube_query_cache_video_id ON youtube_query_cache (video_id)
    WHERE deleted = false AND video_id IS NOT NULL AND btrim(video_id) <> '';

-- support_chat_requests: requester inbox + agent queue
CREATE INDEX idx_support_chat_requests_requester ON support_chat_requests (requester_user_id, created_at DESC)
    WHERE deleted = false;
CREATE INDEX idx_support_chat_requests_assignee ON support_chat_requests (assigned_agent_user_id, status)
    WHERE deleted = false AND assigned_agent_user_id IS NOT NULL;

-- call_sessions: active / pending lookups by participant
CREATE INDEX idx_call_sessions_initiator_status ON call_sessions (initiator_id, status)
    WHERE deleted = false AND initiator_id IS NOT NULL;
CREATE INDEX idx_call_sessions_receiver_status ON call_sessions (receiver_id, status)
    WHERE deleted = false AND receiver_id IS NOT NULL;
CREATE INDEX idx_call_sessions_status_expires ON call_sessions (status, expires_at)
    WHERE deleted = false;

-- audit_events: fetch by resource
CREATE INDEX idx_audit_events_resource ON audit_events (resource_type, resource_id)
    WHERE deleted = false;

-- chat_messages: sender history + idempotent client_message_id per room
CREATE INDEX idx_chat_messages_sender ON chat_messages (sender_id, created_at DESC)
    WHERE deleted = false;
CREATE INDEX idx_chat_messages_room_client_msg ON chat_messages (room_id, client_message_id)
    WHERE deleted = false AND client_message_id IS NOT NULL AND btrim(client_message_id) <> '';
