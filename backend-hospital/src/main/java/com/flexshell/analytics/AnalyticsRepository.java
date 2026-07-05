package com.flexshell.analytics;

import com.flexshell.controller.dto.DailyAppointmentSummaryDto;
import com.flexshell.controller.dto.DoctorComparisonDto;
import com.flexshell.controller.dto.HeatmapCellDto;
import com.flexshell.controller.dto.NewVsReturningDto;
import com.flexshell.controller.dto.PatientRetentionSummaryDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Repository
public class AnalyticsRepository {

    private final JdbcTemplate jdbcTemplate;

    public AnalyticsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<DailyAppointmentSummaryDto> getDailyTrend(String doctorId, LocalDate from, LocalDate to) {
        if (doctorId == null || doctorId.isBlank()) {
            return jdbcTemplate.query("""
                            SELECT appointment_date, NULL::text AS doctor_id,
                                   SUM(total_scheduled) AS total_scheduled,
                                   SUM(total_completed) AS total_completed,
                                   SUM(total_no_show) AS total_no_show,
                                   SUM(total_cancelled) AS total_cancelled,
                                   SUM(total_rescheduled) AS total_rescheduled,
                                   SUM(total_video) AS total_video,
                                   SUM(total_in_person) AS total_in_person,
                                   ROUND(
                                       SUM(total_completed)::numeric / NULLIF(SUM(total_scheduled), 0) * 100,
                                       1
                                   ) AS completion_rate_pct
                            FROM daily_appointment_summary
                            WHERE appointment_date BETWEEN ? AND ?
                            GROUP BY appointment_date
                            ORDER BY appointment_date ASC
                            """,
                    dailyMapper(),
                    Date.valueOf(from),
                    Date.valueOf(to));
        }
        return jdbcTemplate.query("""
                        SELECT appointment_date, doctor_id, total_scheduled, total_completed, total_no_show,
                               total_cancelled, total_rescheduled, total_video, total_in_person, completion_rate_pct
                        FROM daily_appointment_summary
                        WHERE doctor_id = ? AND appointment_date BETWEEN ? AND ?
                        ORDER BY appointment_date ASC
                        """,
                dailyMapper(),
                doctorId,
                Date.valueOf(from),
                Date.valueOf(to));
    }

    public PatientRetentionSummaryDto getRetentionSummary(String doctorId) {
        if (doctorId == null || doctorId.isBlank()) {
            List<PatientRetentionSummaryDto> rows = jdbcTemplate.query("""
                            WITH patient_visits AS (
                                SELECT a.created_by AS patient_id,
                                       COUNT(*)::bigint AS total_visits,
                                       MAX(analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot)) AS last_visit_at
                                FROM appointments a
                                WHERE a.deleted = false
                                  AND a.created_by IS NOT NULL AND btrim(a.created_by) <> ''
                                  AND analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) IS NOT NULL
                                GROUP BY a.created_by
                            )
                            SELECT NULL::text AS doctor_id,
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
                                       WHERE total_visits >= 2 AND last_visit_at < now() - INTERVAL '90 days'
                                   )::bigint AS churned_returning_patients
                            FROM patient_visits
                            """,
                    retentionMapper());
            return rows.isEmpty() ? emptyRetention(null) : rows.get(0);
        }
        List<PatientRetentionSummaryDto> rows = jdbcTemplate.query("""
                        SELECT doctor_id, total_unique_patients, single_visit_patients, returning_patients,
                               loyal_patients, return_rate_pct, churned_returning_patients
                        FROM patient_retention_summary
                        WHERE doctor_id = ?
                        """,
                retentionMapper(),
                doctorId);
        return rows.isEmpty() ? emptyRetention(doctorId) : rows.get(0);
    }

    public List<HeatmapCellDto> getHeatmap(String doctorId) {
        if (doctorId == null || doctorId.isBlank()) {
            return jdbcTemplate.query("""
                            SELECT NULL::text AS doctor_id, day_of_week, hour_slot,
                                   SUM(total_booked) AS total_booked,
                                   SUM(total_completed) AS total_completed,
                                   SUM(total_no_show) AS total_no_show,
                                   ROUND(SUM(total_no_show)::numeric / NULLIF(SUM(total_booked), 0) * 100, 1) AS no_show_rate_pct
                            FROM hourly_slot_heatmap
                            GROUP BY day_of_week, hour_slot
                            ORDER BY day_of_week, hour_slot
                            """,
                    heatmapMapper());
        }
        return jdbcTemplate.query("""
                        SELECT doctor_id, day_of_week, hour_slot, total_booked, total_completed,
                               total_no_show, no_show_rate_pct
                        FROM hourly_slot_heatmap
                        WHERE doctor_id = ?
                        ORDER BY day_of_week, hour_slot
                        """,
                heatmapMapper(),
                doctorId);
    }

    public List<NewVsReturningDto> getNewVsReturningByMonth(String doctorId, int months) {
        int safeMonths = Math.max(1, Math.min(months, 24));
        String doctorFilter = (doctorId == null || doctorId.isBlank()) ? "" : " AND a.doctor_id = ? ";
        String sql = """
                WITH first_visits AS (
                    SELECT a.created_by AS patient_id,
                           MIN(analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot)) AS first_visit_at
                    FROM appointments a
                    WHERE a.deleted = false
                      AND a.created_by IS NOT NULL AND btrim(a.created_by) <> ''
                      AND analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) IS NOT NULL
                """ + doctorFilter + """
                    GROUP BY a.created_by
                ),
                month_visits AS (
                    SELECT date_trunc('month', analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) AT TIME ZONE 'Asia/Kolkata')::date AS month_start,
                           a.created_by AS patient_id
                    FROM appointments a
                    WHERE a.deleted = false
                      AND a.created_by IS NOT NULL AND btrim(a.created_by) <> ''
                      AND analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) IS NOT NULL
                      AND analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot) >= now() - (? || ' months')::interval
                """ + doctorFilter + """
                )
                SELECT mv.month_start,
                       COUNT(DISTINCT mv.patient_id) FILTER (
                           WHERE date_trunc('month', fv.first_visit_at AT TIME ZONE 'Asia/Kolkata')::date = mv.month_start
                       ) AS new_patients,
                       COUNT(DISTINCT mv.patient_id) FILTER (
                           WHERE date_trunc('month', fv.first_visit_at AT TIME ZONE 'Asia/Kolkata')::date < mv.month_start
                       ) AS returning_patients
                FROM month_visits mv
                JOIN first_visits fv ON fv.patient_id = mv.patient_id
                GROUP BY mv.month_start
                ORDER BY mv.month_start ASC
                """;
        Object[] args;
        if (doctorId == null || doctorId.isBlank()) {
            args = new Object[]{String.valueOf(safeMonths)};
        } else {
            args = new Object[]{doctorId, String.valueOf(safeMonths), doctorId};
        }
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Date monthDate = rs.getDate("month_start");
            YearMonth ym = monthDate == null ? null : YearMonth.from(monthDate.toLocalDate());
            return new NewVsReturningDto(
                    NewVsReturningDto.formatMonth(ym),
                    rs.getLong("new_patients"),
                    rs.getLong("returning_patients")
            );
        }, args);
    }

    public List<DoctorComparisonDto> getDoctorComparison(LocalDate from, LocalDate to) {
        return jdbcTemplate.query("""
                        SELECT u.id AS doctor_id,
                               COALESCE(NULLIF(btrim(u.first_name || ' ' || u.last_name), ''), u.username, u.email, u.id) AS doctor_name,
                               COALESCE(SUM(d.total_scheduled), 0) AS total_appointments,
                               ROUND(COALESCE(SUM(d.total_completed), 0)::numeric / NULLIF(SUM(d.total_scheduled), 0) * 100, 1) AS completion_rate_pct,
                               ROUND(COALESCE(SUM(d.total_no_show), 0)::numeric / NULLIF(SUM(d.total_scheduled), 0) * 100, 1) AS no_show_rate_pct,
                               COALESCE(pr.total_unique_patients, 0) AS total_unique_patients,
                               COALESCE(pr.return_rate_pct, 0) AS return_rate_pct,
                               busy.day_of_week AS busiest_day_of_week
                        FROM users u
                        LEFT JOIN daily_appointment_summary d
                            ON d.doctor_id = u.id AND d.appointment_date BETWEEN ? AND ?
                        LEFT JOIN patient_retention_summary pr ON pr.doctor_id = u.id
                        LEFT JOIN LATERAL (
                            SELECT h.day_of_week
                            FROM hourly_slot_heatmap h
                            WHERE h.doctor_id = u.id
                            ORDER BY h.total_booked DESC
                            LIMIT 1
                        ) busy ON true
                        WHERE upper(u.role) = 'DOCTOR' AND u.deleted = false AND u.active = true
                        GROUP BY u.id, u.first_name, u.last_name, u.username, u.email,
                                 pr.total_unique_patients, pr.return_rate_pct, busy.day_of_week
                        HAVING COALESCE(SUM(d.total_scheduled), 0) > 0 OR pr.total_unique_patients IS NOT NULL
                        ORDER BY total_appointments DESC
                        """,
                (rs, rowNum) -> new DoctorComparisonDto(
                        rs.getString("doctor_id"),
                        rs.getString("doctor_name"),
                        rs.getLong("total_appointments"),
                        decimal(rs, "completion_rate_pct"),
                        decimal(rs, "no_show_rate_pct"),
                        rs.getLong("total_unique_patients"),
                        decimal(rs, "return_rate_pct"),
                        (Integer) rs.getObject("busiest_day_of_week")
                ),
                Date.valueOf(from),
                Date.valueOf(to));
    }

    public java.time.Instant getLastRefreshAt() {
        List<java.time.Instant> rows = jdbcTemplate.query("""
                        SELECT refreshed_at FROM analytics_refresh_log ORDER BY refreshed_at DESC LIMIT 1
                        """,
                (rs, rowNum) -> rs.getTimestamp("refreshed_at").toInstant());
        return rows.isEmpty() ? null : rows.get(0);
    }

    public void insertRefreshLog(String triggeredBy, String triggerType, long durationMs) {
        jdbcTemplate.update("""
                        INSERT INTO analytics_refresh_log (triggered_by, trigger_type, duration_ms)
                        VALUES (?, ?, ?)
                        """,
                triggeredBy,
                triggerType,
                durationMs);
    }

    public void refreshMaterializedViews() {
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY daily_appointment_summary");
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY patient_retention_summary");
        jdbcTemplate.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_slot_heatmap");
    }

    public List<DailyAppointmentSummaryDto> listDailyForExport(String doctorId, LocalDate from, LocalDate to) {
        if (doctorId == null || doctorId.isBlank()) {
            return jdbcTemplate.query("""
                            SELECT d.appointment_date, d.doctor_id, d.total_scheduled, d.total_completed,
                                   d.total_no_show, d.total_cancelled, d.total_rescheduled, d.total_video,
                                   d.total_in_person, d.completion_rate_pct
                            FROM daily_appointment_summary d
                            WHERE d.appointment_date BETWEEN ? AND ?
                            ORDER BY d.appointment_date ASC, d.doctor_id ASC
                            """,
                    dailyMapper(),
                    Date.valueOf(from),
                    Date.valueOf(to));
        }
        return getDailyTrend(doctorId, from, to);
    }

    public List<PatientExportRow> listPatientExportRows(String doctorId, int maxRows) {
        String doctorFilter = (doctorId == null || doctorId.isBlank()) ? "" : " AND a.doctor_id = ? ";
        String sql = """
                WITH visits AS (
                    SELECT a.created_by AS patient_id,
                           MAX(a.patient_name) AS patient_name,
                           COUNT(*)::bigint AS total_visits,
                           COUNT(*) FILTER (WHERE upper(btrim(coalesce(a.status, ''))) = 'COMPLETED')::bigint AS completed_visits,
                           MIN(analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot)) AS first_visit_at,
                           MAX(analytics_appointment_at_ist(a.preferred_date, a.preferred_time_slot)) AS last_visit_at
                    FROM appointments a
                    WHERE a.deleted = false
                      AND a.created_by IS NOT NULL AND btrim(a.created_by) <> ''
                """ + doctorFilter + """
                    GROUP BY a.created_by
                )
                SELECT patient_name, total_visits, completed_visits, first_visit_at, last_visit_at
                FROM visits
                ORDER BY last_visit_at DESC NULLS LAST
                LIMIT ?
                """;
        List<Object> args = new ArrayList<>();
        if (doctorId != null && !doctorId.isBlank()) {
            args.add(doctorId);
        }
        args.add(maxRows);
        return jdbcTemplate.query(sql, (rs, rowNum) -> new PatientExportRow(
                rs.getString("patient_name"),
                rs.getLong("total_visits"),
                rs.getLong("completed_visits"),
                rs.getTimestamp("first_visit_at") == null ? null : rs.getTimestamp("first_visit_at").toInstant(),
                rs.getTimestamp("last_visit_at") == null ? null : rs.getTimestamp("last_visit_at").toInstant()
        ), args.toArray());
    }

    public record PatientExportRow(
            String patientName,
            long totalVisits,
            long completedVisits,
            java.time.Instant firstVisitAt,
            java.time.Instant lastVisitAt
    ) {
        public String patientCategory() {
            if (totalVisits <= 1) {
                return "New";
            }
            if (totalVisits >= 5) {
                return "Loyal";
            }
            return "Returning";
        }
    }

    private static PatientRetentionSummaryDto emptyRetention(String doctorId) {
        return new PatientRetentionSummaryDto(
                doctorId,
                0L,
                0L,
                0L,
                0L,
                BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP),
                0L
        );
    }

    private static RowMapper<DailyAppointmentSummaryDto> dailyMapper() {
        return (rs, rowNum) -> new DailyAppointmentSummaryDto(
                toLocalDate(rs.getDate("appointment_date")),
                rs.getString("doctor_id"),
                rs.getLong("total_scheduled"),
                rs.getLong("total_completed"),
                rs.getLong("total_no_show"),
                rs.getLong("total_cancelled"),
                rs.getLong("total_rescheduled"),
                rs.getLong("total_video"),
                rs.getLong("total_in_person"),
                decimal(rs, "completion_rate_pct")
        );
    }

    private static RowMapper<PatientRetentionSummaryDto> retentionMapper() {
        return (rs, rowNum) -> new PatientRetentionSummaryDto(
                rs.getString("doctor_id"),
                rs.getLong("total_unique_patients"),
                rs.getLong("single_visit_patients"),
                rs.getLong("returning_patients"),
                rs.getLong("loyal_patients"),
                decimal(rs, "return_rate_pct"),
                rs.getLong("churned_returning_patients")
        );
    }

    private static RowMapper<HeatmapCellDto> heatmapMapper() {
        return (rs, rowNum) -> new HeatmapCellDto(
                rs.getString("doctor_id"),
                rs.getInt("day_of_week"),
                rs.getInt("hour_slot"),
                rs.getLong("total_booked"),
                rs.getLong("total_completed"),
                rs.getLong("total_no_show"),
                decimal(rs, "no_show_rate_pct")
        );
    }

    private static LocalDate toLocalDate(Date date) {
        return date == null ? null : date.toLocalDate();
    }

    private static BigDecimal decimal(ResultSet rs, String column) throws SQLException {
        BigDecimal value = rs.getBigDecimal(column);
        return value == null ? BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP) : value;
    }
}
