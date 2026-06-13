package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public class PatientDeviceReadingQueryDto {

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    @JsonProperty("DeviceType")
    private String deviceType;

    @JsonProperty("PatientUserId")
    private String patientUserId;

    public UUID getChildProfileExternalId() {
        return childProfileExternalId;
    }

    public void setChildProfileExternalId(UUID childProfileExternalId) {
        this.childProfileExternalId = childProfileExternalId;
    }

    public String getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(String deviceType) {
        this.deviceType = deviceType;
    }

    public String getPatientUserId() {
        return patientUserId;
    }

    public void setPatientUserId(String patientUserId) {
        this.patientUserId = patientUserId;
    }
}
