-- Per-locale copy for medical departments (en, hi) — aligns with server-message-i18n.mdc.

CREATE TABLE medical_department_messages (
    id              BIGSERIAL PRIMARY KEY,
    department_id   TEXT NOT NULL REFERENCES medical_departments (id),
    locale          VARCHAR(16) NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted         BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX idx_medical_department_messages_dept_locale
    ON medical_department_messages (department_id, locale)
    WHERE deleted = false;

CREATE INDEX idx_medical_department_messages_department_id
    ON medical_department_messages (department_id)
    WHERE deleted = false;

-- Backfill English rows from existing department name/description.
INSERT INTO medical_department_messages (department_id, locale, name, description)
SELECT d.id,
       'en',
       COALESCE(NULLIF(trim(d.name), ''), d.code),
       d.description
FROM medical_departments d
WHERE d.deleted = false
  AND NOT EXISTS (
      SELECT 1
      FROM medical_department_messages m
      WHERE m.department_id = d.id
        AND lower(m.locale) = 'en'
        AND m.deleted = false
  );
