-- Backfill Hindi and Kannada medical department messages from English rows.

INSERT INTO medical_department_messages (department_id, locale, name, description)
SELECT m.department_id,
       'hi',
       m.name,
       m.description
FROM medical_department_messages m
WHERE lower(m.locale) = 'en'
  AND m.deleted = false
  AND NOT EXISTS (
      SELECT 1
      FROM medical_department_messages hi
      WHERE hi.department_id = m.department_id
        AND lower(hi.locale) = 'hi'
        AND hi.deleted = false
  );

INSERT INTO medical_department_messages (department_id, locale, name, description)
SELECT m.department_id,
       'kn',
       m.name,
       m.description
FROM medical_department_messages m
WHERE lower(m.locale) = 'en'
  AND m.deleted = false
  AND NOT EXISTS (
      SELECT 1
      FROM medical_department_messages kn
      WHERE kn.department_id = m.department_id
        AND lower(kn.locale) = 'kn'
        AND kn.deleted = false
  );
