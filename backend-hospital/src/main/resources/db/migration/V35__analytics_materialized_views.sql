-- Clinic analytics: materialized views + refresh log (IST aggregations).

-- Single function (no nested BEGIN blocks) so Flyway does not split the migration on inner semicolons.
-- Parses slot start from preferred_time_slot (24h "10:00-10:15" or 12h "10:00 AM - 10:30 AM").
CREATE OR REPLACE FUNCTION analytics_appointment_at_ist(p_date text, p_slot text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
    raw text;
    m text[];
    hh int;
    mm int;
    mer text;
    slot_start time;
BEGIN
    IF p_date IS NULL OR btrim(p_date) = '' THEN
        RETURN NULL;
    END IF;
    IF p_slot IS NULL OR btrim(p_slot) = '' THEN
        RETURN NULL;
    END IF;

    raw := btrim(split_part(p_slot, '-', 1));
    raw := regexp_replace(raw, '\s+', ' ', 'g');

    IF raw ~ '^\d{1,2}:\d{2}(:\d{2})?$' THEN
        slot_start := raw::time;
    ELSE
        m := regexp_match(raw, '^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$');
        IF m IS NOT NULL THEN
            hh := m[1]::int;
            mm := m[2]::int;
            mer := upper(m[3]);
            IF mer = 'AM' AND hh = 12 THEN
                hh := 0;
            ELSIF mer = 'PM' AND hh <> 12 THEN
                hh := hh + 12;
            END IF;
            IF hh BETWEEN 0 AND 23 AND mm BETWEEN 0 AND 59 THEN
                slot_start := make_time(hh, mm, 0);
            END IF;
        END IF;
    END IF;

    IF slot_start IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN (left(btrim(p_date), 10)::date + slot_start) AT TIME ZONE 'Asia/Kolkata';
END;
$fn$;

CREATE TABLE analytics_refresh_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_by  TEXT REFERENCES users (id),
    trigger_type  TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
    refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms   INTEGER
);

CREATE MATERIALIZED VIEW daily_appointment_summary AS
SELECT
    (analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) AT TIME ZONE 'Asia/Kolkata')::date
        AS appointment_date,
    a.doctor_id,
    COUNT(*)::bigint AS total_scheduled,
    COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'COMPLETED')::bigint AS total_completed,
    COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'NO_SHOW')::bigint AS total_no_show,
    COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'CANCELLED')::bigint AS total_cancelled,
    COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'RESCHEDULED')::bigint AS total_rescheduled,
    COUNT(*) FILTER (
        WHERE a.call_status IS NOT NULL OR a.call_start_time IS NOT NULL
    )::bigint AS total_video,
    COUNT(*) FILTER (
        WHERE a.call_status IS NULL AND a.call_start_time IS NULL
    )::bigint AS total_in_person,
    ROUND(
        COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'COMPLETED')::numeric
            / NULLIF(COUNT(*), 0) * 100,
        1
    ) AS completion_rate_pct
FROM appointments a
WHERE a.deleted = false
  AND a.doctor_id IS NOT NULL
  AND analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) IS NOT NULL
GROUP BY 1, 2
WITH DATA;

CREATE UNIQUE INDEX uq_daily_appointment_summary ON daily_appointment_summary (appointment_date, doctor_id);

CREATE MATERIALIZED VIEW patient_retention_summary AS
WITH patient_visits AS (
    SELECT
        a.doctor_id,
        a.created_by AS patient_id,
        COUNT(*)::bigint AS total_visits,
        MIN(analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot)) AS first_visit_at,
        MAX(analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot)) AS last_visit_at,
        COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'COMPLETED')::bigint AS completed_visits
    FROM appointments a
    WHERE a.deleted = false
      AND a.doctor_id IS NOT NULL
      AND a.created_by IS NOT NULL
      AND btrim(a.created_by) <> ''
      AND analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) IS NOT NULL
    GROUP BY a.doctor_id, a.created_by
)
SELECT
    doctor_id,
    COUNT(DISTINCT patient_id)::bigint AS total_unique_patients,
    COUNT(DISTINCT patient_id) FILTER (WHERE total_visits = 1)::bigint AS single_visit_patients,
    COUNT(DISTINCT patient_id) FILTER (WHERE total_visits >= 2)::bigint AS returning_patients,
    COUNT(DISTINCT patient_id) FILTER (WHERE total_visits >= 3)::bigint AS loyal_patients,
    ROUND(
        COUNT(DISTINCT patient_id) FILTER (WHERE total_visits >= 2)::numeric
            / NULLIF(COUNT(DISTINCT patient_id), 0) * 100,
        1
    ) AS return_rate_pct,
    COUNT(DISTINCT patient_id) FILTER (
        WHERE total_visits >= 2
          AND last_visit_at < now() - INTERVAL '90 days'
    )::bigint AS churned_returning_patients
FROM patient_visits
GROUP BY doctor_id
WITH DATA;

CREATE UNIQUE INDEX uq_patient_retention_summary ON patient_retention_summary (doctor_id);

CREATE MATERIALIZED VIEW hourly_slot_heatmap AS
SELECT
    a.doctor_id,
    EXTRACT(DOW FROM analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) AT TIME ZONE 'Asia/Kolkata')::int
        AS day_of_week,
    EXTRACT(HOUR FROM analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) AT TIME ZONE 'Asia/Kolkata')::int
        AS hour_slot,
    COUNT(*)::bigint AS total_booked,
    COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'COMPLETED')::bigint AS total_completed,
    COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'NO_SHOW')::bigint AS total_no_show,
    ROUND(
        COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'NO_SHOW')::numeric
            / NULLIF(COUNT(*), 0) * 100,
        1
    ) AS no_show_rate_pct
FROM appointments a
WHERE a.deleted = false
  AND a.doctor_id IS NOT NULL
  AND analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) IS NOT NULL
GROUP BY a.doctor_id,
    EXTRACT(DOW FROM analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) AT TIME ZONE 'Asia/Kolkata'),
    EXTRACT(HOUR FROM analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) AT TIME ZONE 'Asia/Kolkata')
WITH DATA;

CREATE UNIQUE INDEX uq_hourly_slot_heatmap ON hourly_slot_heatmap (doctor_id, day_of_week, hour_slot);
