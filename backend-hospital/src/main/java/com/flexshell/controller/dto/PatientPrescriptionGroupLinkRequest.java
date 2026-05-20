package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public record PatientPrescriptionGroupLinkRequest(
        @JsonProperty("prescriptionExternalId") UUID prescriptionExternalId,
        @JsonProperty("pageNumber") Integer pageNumber
) {
}
