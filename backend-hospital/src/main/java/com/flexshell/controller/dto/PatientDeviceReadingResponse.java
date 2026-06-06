package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record PatientDeviceReadingResponse(
        @JsonProperty("ExternalId") UUID externalId,
        @JsonProperty("DeviceKey") String deviceKey,
        @JsonProperty("DeviceName") String deviceName,
        @JsonProperty("DeviceType") String deviceType,
        @JsonProperty("Measurements") Map<String, Object> measurements,
        @JsonProperty("RecordedAt") Instant recordedAt,
        @JsonProperty("CreatedAt") Instant createdAt
) {
}
