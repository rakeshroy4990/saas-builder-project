package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PrescriptionValidationResponse {

    @JsonProperty("ExternalId")
    private UUID externalId;

    @JsonProperty("PrescriptionSource")
    private String prescriptionSource;

    @JsonProperty("PatientPrescriptionExternalId")
    private UUID patientPrescriptionExternalId;

    @JsonProperty("StructuredPrescriptionExternalId")
    private UUID structuredPrescriptionExternalId;

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    @JsonProperty("ChildWeightKgUsed")
    private BigDecimal childWeightKgUsed;

    @JsonProperty("ChildAgeMonthsUsed")
    private BigDecimal childAgeMonthsUsed;

    @JsonProperty("TemperatureFUsed")
    private BigDecimal temperatureFUsed;

    @JsonProperty("WeightSource")
    private String weightSource;

    @JsonProperty("OverallRiskLevel")
    private String overallRiskLevel;

    @JsonProperty("InteractionFindings")
    private List<PrescriptionInteractionFindingDto> interactionFindings = new ArrayList<>();

    @JsonProperty("DosageFindings")
    private List<PrescriptionDosageFindingDto> dosageFindings = new ArrayList<>();

    @JsonProperty("UnrecognizedDrugs")
    private List<String> unrecognizedDrugs = new ArrayList<>();

    @JsonProperty("LlmSummary")
    private String llmSummary;

    @JsonProperty("ReviewedByDoctor")
    private boolean reviewedByDoctor;

    @JsonProperty("ReviewedAt")
    private Instant reviewedAt;

    @JsonProperty("CreatedAt")
    private Instant createdAt;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getPrescriptionSource() {
        return prescriptionSource;
    }

    public void setPrescriptionSource(String prescriptionSource) {
        this.prescriptionSource = prescriptionSource;
    }

    public UUID getPatientPrescriptionExternalId() {
        return patientPrescriptionExternalId;
    }

    public void setPatientPrescriptionExternalId(UUID patientPrescriptionExternalId) {
        this.patientPrescriptionExternalId = patientPrescriptionExternalId;
    }

    public UUID getStructuredPrescriptionExternalId() {
        return structuredPrescriptionExternalId;
    }

    public void setStructuredPrescriptionExternalId(UUID structuredPrescriptionExternalId) {
        this.structuredPrescriptionExternalId = structuredPrescriptionExternalId;
    }

    public UUID getChildProfileExternalId() {
        return childProfileExternalId;
    }

    public void setChildProfileExternalId(UUID childProfileExternalId) {
        this.childProfileExternalId = childProfileExternalId;
    }

    public BigDecimal getChildWeightKgUsed() {
        return childWeightKgUsed;
    }

    public void setChildWeightKgUsed(BigDecimal childWeightKgUsed) {
        this.childWeightKgUsed = childWeightKgUsed;
    }

    public BigDecimal getChildAgeMonthsUsed() {
        return childAgeMonthsUsed;
    }

    public void setChildAgeMonthsUsed(BigDecimal childAgeMonthsUsed) {
        this.childAgeMonthsUsed = childAgeMonthsUsed;
    }

    public BigDecimal getTemperatureFUsed() {
        return temperatureFUsed;
    }

    public void setTemperatureFUsed(BigDecimal temperatureFUsed) {
        this.temperatureFUsed = temperatureFUsed;
    }

    public String getWeightSource() {
        return weightSource;
    }

    public void setWeightSource(String weightSource) {
        this.weightSource = weightSource;
    }

    public String getOverallRiskLevel() {
        return overallRiskLevel;
    }

    public void setOverallRiskLevel(String overallRiskLevel) {
        this.overallRiskLevel = overallRiskLevel;
    }

    public List<PrescriptionInteractionFindingDto> getInteractionFindings() {
        return interactionFindings;
    }

    public void setInteractionFindings(List<PrescriptionInteractionFindingDto> interactionFindings) {
        this.interactionFindings = interactionFindings == null ? new ArrayList<>() : interactionFindings;
    }

    public List<PrescriptionDosageFindingDto> getDosageFindings() {
        return dosageFindings;
    }

    public void setDosageFindings(List<PrescriptionDosageFindingDto> dosageFindings) {
        this.dosageFindings = dosageFindings == null ? new ArrayList<>() : dosageFindings;
    }

    public List<String> getUnrecognizedDrugs() {
        return unrecognizedDrugs;
    }

    public void setUnrecognizedDrugs(List<String> unrecognizedDrugs) {
        this.unrecognizedDrugs = unrecognizedDrugs == null ? new ArrayList<>() : unrecognizedDrugs;
    }

    public String getLlmSummary() {
        return llmSummary;
    }

    public void setLlmSummary(String llmSummary) {
        this.llmSummary = llmSummary;
    }

    public boolean isReviewedByDoctor() {
        return reviewedByDoctor;
    }

    public void setReviewedByDoctor(boolean reviewedByDoctor) {
        this.reviewedByDoctor = reviewedByDoctor;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
