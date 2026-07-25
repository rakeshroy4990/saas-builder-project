package com.flexshell.controller.dto.audio;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

public record AudioApplyPrescriptionRequest(
        @JsonProperty("SessionId") String sessionId,
        @JsonProperty("Prescription") Map<String, Object> prescription
) {}
