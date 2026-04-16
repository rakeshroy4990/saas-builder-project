package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class AppointmentRequest {
    @JsonProperty("PatientName")
    private String patientName;
    @JsonProperty("Email")
    private String email;
    @JsonProperty("PhoneNumber")
    private String phoneNumber;
    @JsonProperty("AgeGroup")
    private String ageGroup;
    @JsonProperty("Department")
    private String department;
    @JsonProperty("DoctorId")
    private String doctorId;
    @JsonProperty("PreferredDate")
    private String preferredDate;
    @JsonProperty("PreferredTimeSlot")
    private String preferredTimeSlot;
    @JsonProperty("AdditionalNotes")
    private String additionalNotes;
    @JsonProperty("PrescriptionFileNames")
    private List<String> prescriptionFileNames = new ArrayList<>();

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getAgeGroup() {
        return ageGroup;
    }

    public void setAgeGroup(String ageGroup) {
        this.ageGroup = ageGroup;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }

    public String getPreferredDate() {
        return preferredDate;
    }

    public void setPreferredDate(String preferredDate) {
        this.preferredDate = preferredDate;
    }

    public String getPreferredTimeSlot() {
        return preferredTimeSlot;
    }

    public void setPreferredTimeSlot(String preferredTimeSlot) {
        this.preferredTimeSlot = preferredTimeSlot;
    }

    public String getAdditionalNotes() {
        return additionalNotes;
    }

    public void setAdditionalNotes(String additionalNotes) {
        this.additionalNotes = additionalNotes;
    }

    public List<String> getPrescriptionFileNames() {
        return prescriptionFileNames;
    }

    public void setPrescriptionFileNames(List<String> prescriptionFileNames) {
        this.prescriptionFileNames = prescriptionFileNames;
    }
}
