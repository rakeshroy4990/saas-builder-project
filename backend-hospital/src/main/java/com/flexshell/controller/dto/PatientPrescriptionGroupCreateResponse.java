package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public record PatientPrescriptionGroupCreateResponse(
        @JsonProperty("GroupExternalId") UUID groupExternalId
) {
}
