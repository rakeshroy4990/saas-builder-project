package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ClinicOverviewDto(
        @JsonProperty("DailyTrend") List<DailyAppointmentSummaryDto> dailyTrend,
        @JsonProperty("Retention") PatientRetentionSummaryDto retention,
        @JsonProperty("NewVsReturning") List<NewVsReturningDto> newVsReturning,
        @JsonProperty("Heatmap") List<HeatmapCellDto> heatmap,
        @JsonProperty("SummaryStats") AnalyticsSummaryStatsDto summaryStats,
        @JsonProperty("PreviousPeriod") AnalyticsSummaryStatsDto previousPeriod,
        @JsonProperty("LastRefreshedAt") Instant lastRefreshedAt
) {
}
