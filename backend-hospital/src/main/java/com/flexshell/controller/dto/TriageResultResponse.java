package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class TriageResultResponse {

    @JsonProperty("ExternalId")
    private UUID externalId;

    @JsonProperty("AppointmentExternalId")
    private UUID appointmentExternalId;

    @JsonProperty("PatientUserId")
    private String patientUserId;

    @JsonProperty("ChildDisplayName")
    private String childDisplayName;

    @JsonProperty("ChildAgeMonths")
    private int childAgeMonths;

    @JsonProperty("ChildWeightKg")
    private BigDecimal childWeightKg;

    @JsonProperty("ReportedSymptoms")
    private List<String> reportedSymptoms = new ArrayList<>();

    @JsonProperty("SymptomDurationHours")
    private Integer symptomDurationHours;

    @JsonProperty("SymptomSeverity")
    private String symptomSeverity;

    @JsonProperty("AdditionalNotes")
    private String additionalNotes;

    @JsonProperty("UrgencyLevel")
    private String urgencyLevel;

    @JsonProperty("UrgencyReasoning")
    private String urgencyReasoning;

    @JsonProperty("DoctorNote")
    private String doctorNote;

    @JsonProperty("RedFlags")
    private List<String> redFlags = new ArrayList<>();

    @JsonProperty("Confidence")
    private String confidence;

    @JsonProperty("ModelUsed")
    private String modelUsed;

    @JsonProperty("RagChunksUsed")
    private List<Map<String, Object>> ragChunksUsed = new ArrayList<>();

    @JsonProperty("CreatedAt")
    private String createdAt;

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

    public String getPatientUserId() {
        return patientUserId;
    }

    public void setPatientUserId(String patientUserId) {
        this.patientUserId = patientUserId;
    }

    public String getChildDisplayName() {
        return childDisplayName;
    }

    public void setChildDisplayName(String childDisplayName) {
        this.childDisplayName = childDisplayName;
    }

    public int getChildAgeMonths() {
        return childAgeMonths;
    }

    public void setChildAgeMonths(int childAgeMonths) {
        this.childAgeMonths = childAgeMonths;
    }

    public BigDecimal getChildWeightKg() {
        return childWeightKg;
    }

    public void setChildWeightKg(BigDecimal childWeightKg) {
        this.childWeightKg = childWeightKg;
    }

    public List<String> getReportedSymptoms() {
        return reportedSymptoms;
    }

    public void setReportedSymptoms(List<String> reportedSymptoms) {
        this.reportedSymptoms = reportedSymptoms == null ? new ArrayList<>() : reportedSymptoms;
    }

    public Integer getSymptomDurationHours() {
        return symptomDurationHours;
    }

    public void setSymptomDurationHours(Integer symptomDurationHours) {
        this.symptomDurationHours = symptomDurationHours;
    }

    public String getSymptomSeverity() {
        return symptomSeverity;
    }

    public void setSymptomSeverity(String symptomSeverity) {
        this.symptomSeverity = symptomSeverity;
    }

    public String getAdditionalNotes() {
        return additionalNotes;
    }

    public void setAdditionalNotes(String additionalNotes) {
        this.additionalNotes = additionalNotes;
    }

    public String getUrgencyLevel() {
        return urgencyLevel;
    }

    public void setUrgencyLevel(String urgencyLevel) {
        this.urgencyLevel = urgencyLevel;
    }

    public String getUrgencyReasoning() {
        return urgencyReasoning;
    }

    public void setUrgencyReasoning(String urgencyReasoning) {
        this.urgencyReasoning = urgencyReasoning;
    }

    public String getDoctorNote() {
        return doctorNote;
    }

    public void setDoctorNote(String doctorNote) {
        this.doctorNote = doctorNote;
    }

    public List<String> getRedFlags() {
        return redFlags;
    }

    public void setRedFlags(List<String> redFlags) {
        this.redFlags = redFlags == null ? new ArrayList<>() : redFlags;
    }

    public String getConfidence() {
        return confidence;
    }

    public void setConfidence(String confidence) {
        this.confidence = confidence;
    }

    public String getModelUsed() {
        return modelUsed;
    }

    public void setModelUsed(String modelUsed) {
        this.modelUsed = modelUsed;
    }

    public List<Map<String, Object>> getRagChunksUsed() {
        return ragChunksUsed;
    }

    public void setRagChunksUsed(List<Map<String, Object>> ragChunksUsed) {
        this.ragChunksUsed = ragChunksUsed == null ? new ArrayList<>() : ragChunksUsed;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
