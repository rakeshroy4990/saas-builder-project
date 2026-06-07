package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Upsert body for {@code POST /api/v1/appointments/save} and {@code POST /api/appointment/save}.
 * Business key: {@code Id}.
 */
public class AppointmentSaveRequest extends AppointmentRequest {
    @JsonProperty("Id")
    private String id;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }
}
