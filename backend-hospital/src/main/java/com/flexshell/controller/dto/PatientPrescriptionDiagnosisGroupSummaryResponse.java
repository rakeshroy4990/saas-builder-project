package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record PatientPrescriptionDiagnosisGroupSummaryResponse(
        @JsonProperty("GroupExternalId") UUID groupExternalId,
        @JsonProperty("SharedDiagnosis") String sharedDiagnosis,
        @JsonProperty("Label") String label,
        @JsonProperty("PrescriptionCount") int prescriptionCount,
        @JsonProperty("CreatedAt") Instant createdAt
) {
}
