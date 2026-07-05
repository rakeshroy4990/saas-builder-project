package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record DoctorComparisonDto(
        @JsonProperty("DoctorId") String doctorId,
        @JsonProperty("DoctorName") String doctorName,
        @JsonProperty("TotalAppointments") long totalAppointments,
        @JsonProperty("CompletionRatePct") BigDecimal completionRatePct,
        @JsonProperty("NoShowRatePct") BigDecimal noShowRatePct,
        @JsonProperty("TotalUniquePatients") long totalUniquePatients,
        @JsonProperty("ReturnRatePct") BigDecimal returnRatePct,
        @JsonProperty("BusiestDayOfWeek") Integer busiestDayOfWeek
) {
}
