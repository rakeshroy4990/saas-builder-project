-- Configurable notification event rules (Postgres-backed, i18n via locale column: en, hi).

CREATE TABLE notification_event_rules (
    id              BIGSERIAL PRIMARY KEY,
    external_id     UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    event_type      TEXT NOT NULL,
    recipient_role  TEXT NOT NULL,
    entity_type     TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted         BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX idx_notification_event_rules_event_role
    ON notification_event_rules (event_type, recipient_role)
    WHERE deleted = false;

CREATE TABLE notification_event_rule_messages (
    id               BIGSERIAL PRIMARY KEY,
    rule_id          BIGINT NOT NULL REFERENCES notification_event_rules (id),
    locale           VARCHAR(16) NOT NULL,
    title_template   VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted          BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX idx_notification_event_rule_messages_rule_locale
    ON notification_event_rule_messages (rule_id, locale)
    WHERE deleted = false;

CREATE INDEX idx_notification_event_rules_event_type
    ON notification_event_rules (event_type)
    WHERE deleted = false AND enabled = true;

-- APPOINTMENT_CREATED
INSERT INTO notification_event_rules (event_type, recipient_role, entity_type, sort_order)
VALUES ('APPOINTMENT_CREATED', 'DOCTOR', 'APPOINTMENT', 1),
       ('APPOINTMENT_CREATED', 'ADMIN', 'APPOINTMENT', 2);

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('DOCTOR', 'en', 'New appointment from {patientName}', 'Patient {patientName} booked on {date}'),
                   ('DOCTOR', 'hi', '{patientName} से नया अपॉइंटमेंट', '{patientName} ने {date} को अपॉइंटमेंट बुक किया'),
                   ('ADMIN', 'en', 'New appointment booked', '{patientName} booked with Dr. {doctorName} on {date}'),
                   ('ADMIN', 'hi', 'नया अपॉइंटमेंट बुक हुआ', '{patientName} ने Dr. {doctorName} के साथ {date} को बुक किया')
              ) AS m(recipient_role, locale, title_template, message_template)
              ON r.recipient_role = m.recipient_role
WHERE r.event_type = 'APPOINTMENT_CREATED' AND r.deleted = false;

-- APPOINTMENT_UPDATED
INSERT INTO notification_event_rules (event_type, recipient_role, entity_type, sort_order)
VALUES ('APPOINTMENT_UPDATED', 'PATIENT', 'APPOINTMENT', 1),
       ('APPOINTMENT_UPDATED', 'DOCTOR', 'APPOINTMENT', 2),
       ('APPOINTMENT_UPDATED', 'ADMIN', 'APPOINTMENT', 3);

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('PATIENT', 'en', 'Your appointment was updated', 'Your appointment on {date} has been updated'),
                   ('PATIENT', 'hi', 'आपका अपॉइंटमेंट अपडेट हुआ', 'आपका {date} का अपॉइंटमेंट अपडेट कर दिया गया है'),
                   ('DOCTOR', 'en', 'Appointment details changed', 'Appointment with {patientName} on {date} was updated'),
                   ('DOCTOR', 'hi', 'अपॉइंटमेंट विवरण बदला', '{date} को {patientName} का अपॉइंटमेंट अपडेट हुआ'),
                   ('ADMIN', 'en', 'Appointment updated', 'Appointment between {patientName} and Dr. {doctorName} updated'),
                   ('ADMIN', 'hi', 'अपॉइंटमेंट अपडेट', '{patientName} और Dr. {doctorName} का अपॉइंटमेंट अपडेट हुआ')
              ) AS m(recipient_role, locale, title_template, message_template)
              ON r.recipient_role = m.recipient_role
WHERE r.event_type = 'APPOINTMENT_UPDATED' AND r.deleted = false;

-- APPOINTMENT_DELETED
INSERT INTO notification_event_rules (event_type, recipient_role, entity_type, sort_order)
VALUES ('APPOINTMENT_DELETED', 'PATIENT', 'APPOINTMENT', 1),
       ('APPOINTMENT_DELETED', 'DOCTOR', 'APPOINTMENT', 2);

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('PATIENT', 'en', 'Appointment cancelled', 'Your appointment on {date} has been cancelled'),
                   ('PATIENT', 'hi', 'अपॉइंटमेंट रद्द', 'आपका {date} का अपॉइंटमेंट रद्द कर दिया गया है'),
                   ('DOCTOR', 'en', 'Appointment cancelled by patient', '{patientName} cancelled their appointment on {date}'),
                   ('DOCTOR', 'hi', 'मरीज़ ने अपॉइंटमेंट रद्द किया', '{patientName} ने {date} का अपॉइंटमेंट रद्द किया')
              ) AS m(recipient_role, locale, title_template, message_template)
              ON r.recipient_role = m.recipient_role
WHERE r.event_type = 'APPOINTMENT_DELETED' AND r.deleted = false;

-- PRESCRIPTION_UPLOADED
INSERT INTO notification_event_rules (event_type, recipient_role, entity_type, sort_order)
VALUES ('PRESCRIPTION_UPLOADED', 'PATIENT', 'APPOINTMENT', 1);

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('PATIENT', 'en', 'Prescription ready', 'Dr. {doctorName} has uploaded your prescription'),
                   ('PATIENT', 'hi', 'प्रिस्क्रिप्शन तैयार', 'Dr. {doctorName} ने आपकी प्रिस्क्रिप्शन अपलोड की है')
              ) AS m(recipient_role, locale, title_template, message_template)
              ON r.recipient_role = m.recipient_role
WHERE r.event_type = 'PRESCRIPTION_UPLOADED' AND r.deleted = false;

-- VIDEO_CALL_STARTED
INSERT INTO notification_event_rules (event_type, recipient_role, entity_type, sort_order)
VALUES ('VIDEO_CALL_STARTED', 'PATIENT', 'APPOINTMENT', 1);

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('PATIENT', 'en', 'Video call started', 'Dr. {doctorName} has started the video call — join now'),
                   ('PATIENT', 'hi', 'वीडियो कॉल शुरू', 'Dr. {doctorName} ने वीडियो कॉल शुरू की — अभी जुड़ें')
              ) AS m(recipient_role, locale, title_template, message_template)
              ON r.recipient_role = m.recipient_role
WHERE r.event_type = 'VIDEO_CALL_STARTED' AND r.deleted = false;

-- DOCTOR_APPROVED
INSERT INTO notification_event_rules (event_type, recipient_role, entity_type, sort_order)
VALUES ('DOCTOR_APPROVED', 'DOCTOR', NULL, 1);

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('DOCTOR', 'en', 'Account approved', 'Your doctor account has been approved. You can now accept appointments.'),
                   ('DOCTOR', 'hi', 'खाता स्वीकृत', 'आपका डॉक्टर खाता स्वीकृत हो गया है। अब आप अपॉइंटमेंट स्वीकार कर सकते हैं।')
              ) AS m(recipient_role, locale, title_template, message_template)
              ON r.recipient_role = m.recipient_role
WHERE r.event_type = 'DOCTOR_APPROVED' AND r.deleted = false;

-- USER_REGISTERED
INSERT INTO notification_event_rules (event_type, recipient_role, entity_type, sort_order)
VALUES ('USER_REGISTERED', 'ADMIN', NULL, 1);

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('ADMIN', 'en', 'New user registered', 'New {role} registered: {name}'),
                   ('ADMIN', 'hi', 'नया उपयोगकर्ता पंजीकृत', 'नया {role} पंजीकृत: {name}')
              ) AS m(recipient_role, locale, title_template, message_template)
              ON r.recipient_role = m.recipient_role
WHERE r.event_type = 'USER_REGISTERED' AND r.deleted = false;
