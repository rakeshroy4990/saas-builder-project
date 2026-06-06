package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public record PatientPrescriptionGroupLinkRequest(
        @JsonProperty("PrescriptionExternalId") UUID prescriptionExternalId,
        @JsonProperty("PageNumber") Integer pageNumber
) {
}
