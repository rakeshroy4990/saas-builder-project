package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PatientPrescriptionSimilarityStreamCompleteResponse(
        @JsonProperty("HitCount") int hitCount
) {
}
