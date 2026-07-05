package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record PatientRetentionSummaryDto(
        @JsonProperty("DoctorId") String doctorId,
        @JsonProperty("TotalUniquePatients") long totalUniquePatients,
        @JsonProperty("SingleVisitPatients") long singleVisitPatients,
        @JsonProperty("ReturningPatients") long returningPatients,
        @JsonProperty("LoyalPatients") long loyalPatients,
        @JsonProperty("ReturnRatePct") BigDecimal returnRatePct,
        @JsonProperty("ChurnedReturningPatients") long churnedReturningPatients
) {
}
