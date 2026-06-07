package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

/**
 * Metadata upsert body for {@code POST /api/v1/patient-prescriptions/save}.
 * Business key: {@code ExternalId}. File bytes are created via {@code POST …/upload} only.
 */
public class PatientPrescriptionSaveRequest {
    @JsonProperty("ExternalId")
    private UUID externalId;
    @JsonProperty("Status")
    private String status;
    @JsonProperty("AppointmentExternalId")
    private UUID appointmentExternalId;
    @JsonProperty("DoctorName")
    private String doctorName;
    @JsonProperty("Department")
    private String department;
    @JsonProperty("PatientName")
    private String patientName;
    @JsonProperty("PatientGender")
    private String patientGender;
    @JsonProperty("GroupExternalId")
    private UUID groupExternalId;
    @JsonProperty("PageNumber")
    private Integer pageNumber;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UUID getAppointmentExternalId() {
        return appointmentExternalId;
    }

    public void setAppointmentExternalId(UUID appointmentExternalId) {
        this.appointmentExternalId = appointmentExternalId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getPatientGender() {
        return patientGender;
    }

    public void setPatientGender(String patientGender) {
        this.patientGender = patientGender;
    }

    public UUID getGroupExternalId() {
        return groupExternalId;
    }

    public void setGroupExternalId(UUID groupExternalId) {
        this.groupExternalId = groupExternalId;
    }

    public Integer getPageNumber() {
        return pageNumber;
    }

    public void setPageNumber(Integer pageNumber) {
        this.pageNumber = pageNumber;
    }
}
