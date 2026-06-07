package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public class SessionTelemetryBatchRequest {

    @JsonProperty("Events")
    @NotNull
    @Size(min = 1, max = 100)
    private List<@Valid SessionTelemetryEventRequest> events;

    public List<SessionTelemetryEventRequest> getEvents() {
        return events;
    }

    public void setEvents(List<SessionTelemetryEventRequest> events) {
        this.events = events;
    }
}
