package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record PatientPrescriptionSimilarityDetailsResponse(
        @JsonProperty("Diagnosis") String diagnosis,
        @JsonProperty("Medicines") List<String> medicines,
        @JsonProperty("Dosage") List<String> dosage,
        @JsonProperty("Advice") List<String> advice,
        @JsonProperty("Notes") String notes
) {
    public static PatientPrescriptionSimilarityDetailsResponse empty() {
        return new PatientPrescriptionSimilarityDetailsResponse("", List.of(), List.of(), List.of(), "");
    }
}
