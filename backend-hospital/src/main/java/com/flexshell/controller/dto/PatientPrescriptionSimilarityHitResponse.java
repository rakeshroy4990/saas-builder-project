package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record PatientPrescriptionSimilarityHitResponse(
        @JsonProperty("externalId") UUID externalId,
        @JsonProperty("matchPercent") double matchPercent,
        @JsonProperty("status") String status,
        @JsonProperty("patientName") String patientName,
        @JsonProperty("doctorName") String doctorName,
        @JsonProperty("department") String department,
        @JsonProperty("gender") String gender,
        @JsonProperty("searchText") String searchText,
        @JsonProperty("details") PatientPrescriptionSimilarityDetailsResponse details,
        @JsonProperty("createdAt") Instant createdAt
) {
}
