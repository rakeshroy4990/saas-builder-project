-- Maps HTTP actions to canonical domain event types.
-- Notification rules reference event_type; no Java changes needed when adding new rules.
-- Auto-emitted events use catalog bindings when present, otherwise a derived event name.

CREATE TABLE domain_action_events (
    id                   BIGSERIAL PRIMARY KEY,
    external_id          UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    http_method          VARCHAR(16) NOT NULL,
    endpoint_pattern     TEXT NOT NULL,
    event_type           TEXT NOT NULL,
    context_profile      TEXT NOT NULL DEFAULT 'GENERIC',
    actor_role_filter    TEXT,
    response_role_field  TEXT,
    response_role_value  TEXT,
    enabled              BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted              BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX idx_domain_action_events_method_pattern
    ON domain_action_events (http_method, endpoint_pattern)
    WHERE deleted = false;

CREATE INDEX idx_domain_action_events_event_type
    ON domain_action_events (event_type)
    WHERE deleted = false AND enabled = true;

INSERT INTO domain_action_events (http_method, endpoint_pattern, event_type, context_profile)
VALUES
    ('POST', '/api/appointment/create', 'APPOINTMENT_CREATED', 'APPOINTMENT'),
    ('PUT', '/api/appointment/update/{id}', 'APPOINTMENT_UPDATED', 'APPOINTMENT'),
    ('DELETE', '/api/appointment/delete/{id}', 'APPOINTMENT_DELETED', 'APPOINTMENT'),
    ('POST', '/api/appointment/cancel/{id}', 'APPOINTMENT_DELETED', 'APPOINTMENT'),
    ('POST', '/api/prescription/appointment/{appointmentId}/finalize', 'PRESCRIPTION_UPLOADED', 'APPOINTMENT'),
    ('POST', '/api/auth/register', 'USER_REGISTERED', 'USER'),
    ('POST', '/api/admin/role-requests/{userId}/approve', 'DOCTOR_APPROVED', 'USER');

UPDATE domain_action_events
SET response_role_field = 'role',
    response_role_value = 'DOCTOR'
WHERE event_type = 'DOCTOR_APPROVED' AND deleted = false;
