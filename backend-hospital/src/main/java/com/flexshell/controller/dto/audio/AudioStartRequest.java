package com.flexshell.controller.dto.audio;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AudioStartRequest(
        @JsonProperty("AppointmentId") String appointmentId,
        @JsonProperty("LanguageHint") String languageHint,
        @JsonProperty("ConsentAcknowledged") Boolean consentAcknowledged
) {}
