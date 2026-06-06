package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public record PatientPrescriptionUploadResponse(
        @JsonProperty("ExternalId") UUID externalId,
        @JsonProperty("IsDuplicate") boolean isDuplicate,
        @JsonProperty("Status") String status
) {
}
