package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class AppointmentQueryDto {
    @JsonProperty("DoctorId")
    private String doctorId;
    @JsonProperty("Status")
    private String status;
    @JsonProperty("PreferredDate")
    private String preferredDate;
    @JsonProperty("PatientName")
    private String patientName;

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPreferredDate() {
        return preferredDate;
    }

    public void setPreferredDate(String preferredDate) {
        this.preferredDate = preferredDate;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }
}
