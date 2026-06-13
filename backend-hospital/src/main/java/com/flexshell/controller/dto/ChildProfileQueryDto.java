package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class ChildProfileQueryDto {

    @JsonProperty("DisplayName")
    private String displayName;

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    @JsonProperty("PatientUserId")
    private String patientUserId;

    public String getPatientUserId() {
        return patientUserId;
    }

    public void setPatientUserId(String patientUserId) {
        this.patientUserId = patientUserId;
    }
}
