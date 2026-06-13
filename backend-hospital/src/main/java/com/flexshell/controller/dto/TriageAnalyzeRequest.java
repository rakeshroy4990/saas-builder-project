package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class TriageAnalyzeRequest {

    @JsonProperty("ChildDisplayName")
    private String childDisplayName;

    @JsonProperty("ChildAgeMonths")
    private Integer childAgeMonths;

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

    @JsonProperty("AppointmentExternalId")
    private UUID appointmentExternalId;

    public String getChildDisplayName() {
        return childDisplayName;
    }

    public void setChildDisplayName(String childDisplayName) {
        this.childDisplayName = childDisplayName;
    }

    public Integer getChildAgeMonths() {
        return childAgeMonths;
    }

    public void setChildAgeMonths(Integer childAgeMonths) {
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

    public UUID getAppointmentExternalId() {
        return appointmentExternalId;
    }

    public void setAppointmentExternalId(UUID appointmentExternalId) {
        this.appointmentExternalId = appointmentExternalId;
    }
}
