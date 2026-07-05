package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record SmartWatchSyncReadingItem(
        @JsonProperty("RecordedAt") Instant recordedAt,
        @JsonProperty("Measurements") Map<String, Object> measurements
) {
    public SmartWatchSyncReadingItem {
        measurements = measurements == null ? new LinkedHashMap<>() : measurements;
    }
}
