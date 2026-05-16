package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PatientPrescriptionDownloadResponse(
        @JsonProperty("signedUrl") String signedUrl,
        @JsonProperty("expiresIn") int expiresIn
) {
}
