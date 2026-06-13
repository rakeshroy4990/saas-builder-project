package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record PatientDeviceReadingCreateRequest(
        @JsonProperty("DeviceKey") String deviceKey,
        @JsonProperty("DeviceName") String deviceName,
        @JsonProperty("DeviceType") String deviceType,
        @JsonProperty("Measurements") Map<String, Object> measurements,
        @JsonProperty("RecordedAt") Instant recordedAt,
        @JsonProperty("RawBytesBase64") String rawBytesBase64,
        @JsonProperty("ChildProfileExternalId") UUID childProfileExternalId,
        @JsonProperty("AppointmentExternalId") UUID appointmentExternalId
) {
}
