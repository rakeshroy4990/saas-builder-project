-- Kannada (kn) notification templates — mirrors en/hi rows from V17.

INSERT INTO notification_event_rule_messages (rule_id, locale, title_template, message_template)
SELECT r.id, m.locale, m.title_template, m.message_template
FROM notification_event_rules r
         JOIN (VALUES
                   ('APPOINTMENT_CREATED', 'DOCTOR', 'kn', '{patientName} ಅವರಿಂದ ಹೊಸ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್', '{patientName} {date} ದಿನಾಂಕಕ್ಕೆ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿದ್ದಾರೆ'),
                   ('APPOINTMENT_CREATED', 'ADMIN', 'kn', 'ಹೊಸ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬುಕ್ ಆಗಿದೆ', '{patientName} Dr. {doctorName} ಜೊತೆ {date} ದಿನಾಂಕಕ್ಕೆ ಬುಕ್ ಮಾಡಿದ್ದಾರೆ'),
                   ('APPOINTMENT_UPDATED', 'PATIENT', 'kn', 'ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ', '{date} ದಿನಾಂಕದ ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಅಪ್‌ಡೇಟ್ ಮಾಡಲಾಗಿದೆ'),
                   ('APPOINTMENT_UPDATED', 'DOCTOR', 'kn', 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ವಿವರ ಬದಲಾಯಿಸಲಾಗಿದೆ', '{date} ದಿನಾಂಕದ {patientName} ಅವರ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ'),
                   ('APPOINTMENT_UPDATED', 'ADMIN', 'kn', 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಅಪ್‌ಡೇಟ್', '{patientName} ಮತ್ತು Dr. {doctorName} ಅವರ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ'),
                   ('APPOINTMENT_DELETED', 'PATIENT', 'kn', 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ರದ್ದು', '{date} ದಿನಾಂಕದ ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ರದ್ದು ಮಾಡಲಾಗಿದೆ'),
                   ('APPOINTMENT_DELETED', 'DOCTOR', 'kn', 'ರೋಗಿ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ರದ್ದು ಮಾಡಿದ್ದಾರೆ', '{patientName} {date} ದಿನಾಂಕದ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ರದ್ದು ಮಾಡಿದ್ದಾರೆ'),
                   ('PRESCRIPTION_UPLOADED', 'PATIENT', 'kn', 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್ ಸಿದ್ಧ', 'Dr. {doctorName} ನಿಮ್ಮ ಪ್ರಿಸ್ಕ್ರಿಪ್ಶನ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ್ದಾರೆ'),
                   ('VIDEO_CALL_STARTED', 'PATIENT', 'kn', 'ವೀಡಿಯೋ ಕಾಲ್ ಪ್ರಾರಂಭ', 'Dr. {doctorName} ವೀಡಿಯೋ ಕಾಲ್ ಪ್ರಾರಂಭಿಸಿದ್ದಾರೆ — ಈಗ ಸೇರಿ'),
                   ('DOCTOR_APPROVED', 'DOCTOR', 'kn', 'ಖಾತೆ ಅನುಮೋದಿಸಲಾಗಿದೆ', 'ನಿಮ್ಮ ವೈದ್ಯ ಖಾತೆ ಅನುಮೋದಿಸಲಾಗಿದೆ. ಈಗ ನೀವು ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳನ್ನು ಸ್ವೀಕರಿಸಬಹುದು.'),
                   ('USER_REGISTERED', 'ADMIN', 'kn', 'ಹೊಸ ಬಳಕೆದಾರ ನೋಂದಣಿ', 'ಹೊಸ {role} ನೋಂದಣಿ: {name}')
              ) AS m(event_type, recipient_role, locale, title_template, message_template)
              ON r.event_type = m.event_type AND r.recipient_role = m.recipient_role
WHERE r.deleted = false
  AND NOT EXISTS (
      SELECT 1
      FROM notification_event_rule_messages existing
      WHERE existing.rule_id = r.id
        AND lower(existing.locale) = 'kn'
        AND existing.deleted = false
  );
