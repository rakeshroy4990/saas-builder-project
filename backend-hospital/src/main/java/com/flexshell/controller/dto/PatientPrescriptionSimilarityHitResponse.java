package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PatientPrescriptionSimilarityHitResponse(
        @JsonProperty("ExternalId") UUID externalId,
        @JsonProperty("MatchPercent") double matchPercent,
        @JsonProperty("Status") String status,
        @JsonProperty("PatientName") String patientName,
        @JsonProperty("DoctorName") String doctorName,
        @JsonProperty("Department") String department,
        @JsonProperty("Gender") String gender,
        @JsonProperty("SearchText") String searchText,
        @JsonProperty("Details") PatientPrescriptionSimilarityDetailsResponse details,
        @JsonProperty("SectionBreakdown") List<PatientPrescriptionSimilaritySectionScoreResponse> sectionBreakdown,
        @JsonProperty("CreatedAt") Instant createdAt
) {
}
