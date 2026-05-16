package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public record PatientPrescriptionUploadResponse(
        @JsonProperty("externalId") UUID externalId,
        @JsonProperty("isDuplicate") boolean isDuplicate,
        @JsonProperty("status") String status
) {
}
