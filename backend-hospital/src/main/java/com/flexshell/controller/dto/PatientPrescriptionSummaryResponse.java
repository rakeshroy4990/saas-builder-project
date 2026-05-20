package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record PatientPrescriptionSummaryResponse(
        @JsonProperty("externalId") UUID externalId,
        @JsonProperty("status") String status,
        @JsonProperty("mimeType") String mimeType,
        @JsonProperty("fileSizeBytes") Integer fileSizeBytes,
        @JsonProperty("createdAt") Instant createdAt,
        @JsonProperty("doctorName") String doctorName,
        @JsonProperty("department") String department,
        @JsonProperty("patientName") String patientName,
        @JsonProperty("gender") String gender,
        @JsonProperty("extractedData") Map<String, Object> extractedData,
        @JsonProperty("groupExternalId") UUID groupExternalId,
        @JsonProperty("pageNumber") Integer pageNumber,
        @JsonProperty("isPrimaryPage") Boolean isPrimaryPage,
        @JsonProperty("groupType") String groupType,
        @JsonProperty("sharedDiagnosis") String sharedDiagnosis
) {
}
