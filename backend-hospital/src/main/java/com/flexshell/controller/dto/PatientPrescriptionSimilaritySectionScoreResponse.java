package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Cosine similarity for one clinical section (query vs matched prescription).
 */
public record PatientPrescriptionSimilaritySectionScoreResponse(
        @JsonProperty("Section") String section,
        @JsonProperty("MatchPercent") double matchPercent
) {
}
