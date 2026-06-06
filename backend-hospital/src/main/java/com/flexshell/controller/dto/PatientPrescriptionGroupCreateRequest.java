package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PatientPrescriptionGroupCreateRequest(
        @JsonProperty("Label") String label,
        @JsonProperty("GroupType") String groupType,
        @JsonProperty("SharedDiagnosis") String sharedDiagnosis
) {
}
