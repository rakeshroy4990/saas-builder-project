package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record AnalyticsSummaryStatsDto(
        @JsonProperty("TotalAppointments") long totalAppointments,
        @JsonProperty("TotalCompleted") long totalCompleted,
        @JsonProperty("TotalNoShows") long totalNoShows,
        @JsonProperty("TotalCancelled") long totalCancelled,
        @JsonProperty("TotalRescheduled") long totalRescheduled,
        @JsonProperty("CompletionRatePct") BigDecimal completionRatePct,
        @JsonProperty("TotalUniquePatients") long totalUniquePatients,
        @JsonProperty("ReturnRatePct") BigDecimal returnRatePct,
        @JsonProperty("BusiestDayOfWeek") Integer busiestDayOfWeek,
        @JsonProperty("BusiestHour") Integer busiestHour
) {
}
