package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Cosine similarity for one clinical section (query vs matched prescription).
 */
public record PatientPrescriptionSimilaritySectionScoreResponse(
        @JsonProperty("section") String section,
        @JsonProperty("matchPercent") double matchPercent
) {
}
