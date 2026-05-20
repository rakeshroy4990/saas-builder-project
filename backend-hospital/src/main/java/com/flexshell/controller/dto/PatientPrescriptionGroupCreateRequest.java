package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PatientPrescriptionGroupCreateRequest(
        @JsonProperty("label") String label,
        @JsonProperty("groupType") String groupType,
        @JsonProperty("sharedDiagnosis") String sharedDiagnosis
) {
}
