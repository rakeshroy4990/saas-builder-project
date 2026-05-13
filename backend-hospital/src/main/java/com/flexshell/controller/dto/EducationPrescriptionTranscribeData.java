package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Structured prescription extract for doctor education (no raw document logging).
 */
public record EducationPrescriptionTranscribeData(
        @JsonProperty("diagnosis") String diagnosis,
        @JsonProperty("medications") String medications
) {
}
