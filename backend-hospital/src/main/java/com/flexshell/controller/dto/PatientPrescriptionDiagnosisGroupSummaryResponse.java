package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record PatientPrescriptionDiagnosisGroupSummaryResponse(
        @JsonProperty("groupExternalId") UUID groupExternalId,
        @JsonProperty("sharedDiagnosis") String sharedDiagnosis,
        @JsonProperty("label") String label,
        @JsonProperty("prescriptionCount") int prescriptionCount,
        @JsonProperty("createdAt") Instant createdAt
) {
}
