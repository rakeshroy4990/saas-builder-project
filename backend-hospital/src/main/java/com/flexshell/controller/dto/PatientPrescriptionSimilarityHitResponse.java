package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;
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
        @JsonProperty("sectionBreakdown") List<PatientPrescriptionSimilaritySectionScoreResponse> sectionBreakdown,
        @JsonProperty("createdAt") Instant createdAt
) {
}
