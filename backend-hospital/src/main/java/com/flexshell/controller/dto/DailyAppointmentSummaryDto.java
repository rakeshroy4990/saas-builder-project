package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DailyAppointmentSummaryDto(
        @JsonProperty("AppointmentDate") LocalDate appointmentDate,
        @JsonProperty("DoctorId") String doctorId,
        @JsonProperty("TotalScheduled") long totalScheduled,
        @JsonProperty("TotalCompleted") long totalCompleted,
        @JsonProperty("TotalNoShow") long totalNoShow,
        @JsonProperty("TotalCancelled") long totalCancelled,
        @JsonProperty("TotalRescheduled") long totalRescheduled,
        @JsonProperty("TotalVideo") long totalVideo,
        @JsonProperty("TotalInPerson") long totalInPerson,
        @JsonProperty("CompletionRatePct") BigDecimal completionRatePct
) {
}
