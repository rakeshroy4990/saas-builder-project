CREATE TABLE notifications (
    id                  BIGSERIAL PRIMARY KEY,
    external_id         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    recipient_user_id   TEXT NOT NULL REFERENCES users (id),
    recipient_role      TEXT NOT NULL,
    event_type          TEXT NOT NULL,
    title               VARCHAR(255) NOT NULL,
    message             TEXT NOT NULL,
    entity_type         TEXT,
    entity_external_id  UUID,
    entity_ref_id       TEXT,
    is_read             BOOLEAN NOT NULL DEFAULT false,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by_user_id  TEXT,
    deleted             BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_notifications_recipient_unread
    ON notifications (recipient_user_id, is_read, created_at DESC)
    WHERE deleted = false;
