package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record PatientDeviceReadingResponse(
        @JsonProperty("externalId") UUID externalId,
        @JsonProperty("deviceKey") String deviceKey,
        @JsonProperty("deviceName") String deviceName,
        @JsonProperty("deviceType") String deviceType,
        @JsonProperty("measurements") Map<String, Object> measurements,
        @JsonProperty("recordedAt") Instant recordedAt,
        @JsonProperty("createdAt") Instant createdAt
) {
}
