package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PatientPrescriptionDownloadResponse(
        @JsonProperty("SignedUrl") String signedUrl,
        @JsonProperty("ExpiresIn") int expiresIn
) {
}
