package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record PatientPrescriptionSummaryResponse(
        @JsonProperty("ExternalId") UUID externalId,
        @JsonProperty("Status") String status,
        @JsonProperty("MimeType") String mimeType,
        @JsonProperty("FileSizeBytes") Integer fileSizeBytes,
        @JsonProperty("CreatedAt") Instant createdAt,
        @JsonProperty("DoctorName") String doctorName,
        @JsonProperty("Department") String department,
        @JsonProperty("PatientName") String patientName,
        @JsonProperty("Gender") String gender,
        @JsonProperty("ExtractedData") Map<String, Object> extractedData,
        @JsonProperty("GroupExternalId") UUID groupExternalId,
        @JsonProperty("PageNumber") Integer pageNumber,
        @JsonProperty("IsPrimaryPage") Boolean isPrimaryPage,
        @JsonProperty("GroupType") String groupType,
        @JsonProperty("SharedDiagnosis") String sharedDiagnosis
) {
}
