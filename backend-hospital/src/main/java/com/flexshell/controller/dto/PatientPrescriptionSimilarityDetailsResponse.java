package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record PatientPrescriptionSimilarityDetailsResponse(
        @JsonProperty("diagnosis") String diagnosis,
        @JsonProperty("medicines") List<String> medicines,
        @JsonProperty("dosage") List<String> dosage,
        @JsonProperty("advice") List<String> advice,
        @JsonProperty("notes") String notes
) {
    public static PatientPrescriptionSimilarityDetailsResponse empty() {
        return new PatientPrescriptionSimilarityDetailsResponse("", List.of(), List.of(), List.of(), "");
    }
}
