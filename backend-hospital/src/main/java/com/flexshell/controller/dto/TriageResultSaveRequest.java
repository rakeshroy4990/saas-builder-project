package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public class TriageResultSaveRequest {

    @JsonProperty("ExternalId")
    private UUID externalId;

    @JsonProperty("AppointmentExternalId")
    private UUID appointmentExternalId;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public UUID getAppointmentExternalId() {
        return appointmentExternalId;
    }

    public void setAppointmentExternalId(UUID appointmentExternalId) {
        this.appointmentExternalId = appointmentExternalId;
    }
}
