package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public record SmartWatchSyncRequest(
        @JsonProperty("Platform") String platform,
        @JsonProperty("ChildProfileExternalId") UUID childProfileExternalId,
        @JsonProperty("Readings") List<SmartWatchSyncReadingItem> readings
) {
    public SmartWatchSyncRequest {
        readings = readings == null ? new ArrayList<>() : readings;
    }
}
