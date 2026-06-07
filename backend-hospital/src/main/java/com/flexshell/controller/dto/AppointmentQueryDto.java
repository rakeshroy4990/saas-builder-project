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
    @JsonProperty("Department")
    private String department;
    @JsonProperty("UpcomingOnly")
    private Boolean upcomingOnly;

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

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public Boolean getUpcomingOnly() {
        return upcomingOnly;
    }

    public void setUpcomingOnly(Boolean upcomingOnly) {
        this.upcomingOnly = upcomingOnly;
    }
}
