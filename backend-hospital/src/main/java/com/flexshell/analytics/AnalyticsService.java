package com.flexshell.analytics;

import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.AnalyticsSummaryStatsDto;
import com.flexshell.controller.dto.ClinicOverviewDto;
import com.flexshell.controller.dto.DailyAppointmentSummaryDto;
import com.flexshell.controller.dto.DoctorComparisonDto;
import com.flexshell.controller.dto.HeatmapCellDto;
import com.flexshell.controller.dto.NewVsReturningDto;
import com.flexshell.controller.dto.PatientRetentionSummaryDto;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class AnalyticsService {

    private final AnalyticsRepository analyticsRepository;

    public AnalyticsService(
            AnalyticsRepository analyticsRepository
    ) {
        this.analyticsRepository = analyticsRepository;
    }

    public String resolveScopedDoctorId(String actorUserId, List<String> roles, String requestedDoctorId) {
        UserRole role = resolveRole(roles);
        if (role == UserRole.PATIENT) {
            throw new SecurityException("Forbidden");
        }
        if (role == UserRole.DOCTOR) {
            return normalize(actorUserId);
        }
        String requested = normalize(requestedDoctorId);
        return requested.isBlank() ? null : requested;
    }

    public void assertAnalyticsAccess(List<String> roles) {
        UserRole role = resolveRole(roles);
        if (role == UserRole.PATIENT) {
            throw new SecurityException("Forbidden");
        }
    }

    public void assertAdmin(List<String> roles) {
        if (resolveRole(roles) != UserRole.ADMIN) {
            throw new SecurityException("Forbidden");
        }
    }

    public ClinicOverviewDto getOverview(
            String actorUserId,
            List<String> roles,
            LocalDate from,
            LocalDate to,
            String requestedDoctorId
    ) {
        assertAnalyticsAccess(roles);
        LocalDate[] range = normalizeRange(from, to);
        String doctorId = resolveScopedDoctorId(actorUserId, roles, requestedDoctorId);

        List<DailyAppointmentSummaryDto> dailyTrend = analyticsRepository.getDailyTrend(doctorId, range[0], range[1]);
        PatientRetentionSummaryDto retention = analyticsRepository.getRetentionSummary(doctorId);
        List<NewVsReturningDto> newVsReturning = analyticsRepository.getNewVsReturningByMonth(doctorId, 6);
        List<HeatmapCellDto> heatmap = analyticsRepository.getHeatmap(doctorId);

        AnalyticsSummaryStatsDto summaryStats = computeSummaryStats(dailyTrend, retention, heatmap);
        long days = ChronoUnit.DAYS.between(range[0], range[1]) + 1;
        LocalDate prevTo = range[0].minusDays(1);
        LocalDate prevFrom = prevTo.minusDays(days - 1);
        List<DailyAppointmentSummaryDto> prevTrend = analyticsRepository.getDailyTrend(doctorId, prevFrom, prevTo);
        PatientRetentionSummaryDto prevRetention = analyticsRepository.getRetentionSummary(doctorId);
        AnalyticsSummaryStatsDto previousPeriod = computeSummaryStats(prevTrend, prevRetention, heatmap);

        return new ClinicOverviewDto(
                dailyTrend,
                retention,
                newVsReturning,
                heatmap,
                summaryStats,
                previousPeriod,
                analyticsRepository.getLastRefreshAt()
        );
    }

    public List<DailyAppointmentSummaryDto> getTrend(
            String actorUserId,
            List<String> roles,
            LocalDate from,
            LocalDate to,
            String requestedDoctorId
    ) {
        assertAnalyticsAccess(roles);
        LocalDate[] range = normalizeRange(from, to);
        String doctorId = resolveScopedDoctorId(actorUserId, roles, requestedDoctorId);
        return analyticsRepository.getDailyTrend(doctorId, range[0], range[1]);
    }

    public List<HeatmapCellDto> getHeatmap(String actorUserId, List<String> roles, String requestedDoctorId) {
        assertAnalyticsAccess(roles);
        String doctorId = resolveScopedDoctorId(actorUserId, roles, requestedDoctorId);
        return analyticsRepository.getHeatmap(doctorId);
    }

    public RetentionBundle getRetention(String actorUserId, List<String> roles, String requestedDoctorId) {
        assertAnalyticsAccess(roles);
        String doctorId = resolveScopedDoctorId(actorUserId, roles, requestedDoctorId);
        return new RetentionBundle(
                analyticsRepository.getRetentionSummary(doctorId),
                analyticsRepository.getNewVsReturningByMonth(doctorId, 6)
        );
    }

    public List<DoctorComparisonDto> getDoctorComparison(
            String actorUserId,
            List<String> roles,
            LocalDate from,
            LocalDate to
    ) {
        assertAdmin(roles);
        LocalDate[] range = normalizeRange(from, to);
        return analyticsRepository.getDoctorComparison(range[0], range[1]);
    }

    public AnalyticsSummaryStatsDto computeSummaryStats(
            List<DailyAppointmentSummaryDto> dailyTrend,
            PatientRetentionSummaryDto retention,
            List<HeatmapCellDto> heatmap
    ) {
        long totalScheduled = dailyTrend.stream().mapToLong(DailyAppointmentSummaryDto::totalScheduled).sum();
        long totalCompleted = dailyTrend.stream().mapToLong(DailyAppointmentSummaryDto::totalCompleted).sum();
        long totalNoShow = dailyTrend.stream().mapToLong(DailyAppointmentSummaryDto::totalNoShow).sum();
        long totalCancelled = dailyTrend.stream().mapToLong(DailyAppointmentSummaryDto::totalCancelled).sum();
        long totalRescheduled = dailyTrend.stream().mapToLong(DailyAppointmentSummaryDto::totalRescheduled).sum();
        BigDecimal completionRate = pct(totalCompleted, totalScheduled);

        HeatmapCellDto busiest = heatmap.stream()
                .max(Comparator.comparingLong(HeatmapCellDto::totalBooked))
                .orElse(null);

        return new AnalyticsSummaryStatsDto(
                totalScheduled,
                totalCompleted,
                totalNoShow,
                totalCancelled,
                totalRescheduled,
                completionRate,
                retention == null ? 0L : retention.totalUniquePatients(),
                retention == null ? BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP) : retention.returnRatePct(),
                busiest == null ? null : busiest.dayOfWeek(),
                busiest == null ? null : busiest.hourSlot()
        );
    }

    public record RetentionBundle(
            PatientRetentionSummaryDto retention,
            List<NewVsReturningDto> newVsReturning
    ) {
    }

    private static LocalDate[] normalizeRange(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(29) : from;
        if (start.isAfter(end)) {
            LocalDate tmp = start;
            start = end;
            end = tmp;
        }
        return new LocalDate[]{start, end};
    }

    private static BigDecimal pct(long numerator, long denominator) {
        if (denominator <= 0) {
            return BigDecimal.ZERO.setScale(1, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 1, RoundingMode.HALF_UP);
    }

    private UserRole resolveRole(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return UserRole.PATIENT;
        }
        for (String raw : roles) {
            if (raw == null) {
                continue;
            }
            String normalized = raw.trim().toUpperCase().replace("ROLE_", "");
            if ("ADMIN".equals(normalized)) {
                return UserRole.ADMIN;
            }
            if ("DOCTOR".equals(normalized)) {
                return UserRole.DOCTOR;
            }
        }
        return UserRole.PATIENT;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
