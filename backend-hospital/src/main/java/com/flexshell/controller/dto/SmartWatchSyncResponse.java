package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public record SmartWatchSyncResponse(
        @JsonProperty("ImportedCount") int importedCount,
        @JsonProperty("Readings") List<PatientDeviceReadingResponse> readings
) {
    public SmartWatchSyncResponse {
        readings = readings == null ? new ArrayList<>() : readings;
    }
}
