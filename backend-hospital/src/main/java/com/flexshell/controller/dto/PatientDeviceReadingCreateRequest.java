package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;

public record PatientDeviceReadingCreateRequest(
        @JsonProperty("deviceKey") String deviceKey,
        @JsonProperty("deviceName") String deviceName,
        @JsonProperty("deviceType") String deviceType,
        @JsonProperty("measurements") Map<String, Object> measurements,
        @JsonProperty("recordedAt") Instant recordedAt,
        @JsonProperty("rawBytesBase64") String rawBytesBase64
) {
}
