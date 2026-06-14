package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "prescription_validations")
public class PrescriptionValidationJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId = UUID.randomUUID();

    @Column(name = "prescription_source", nullable = false, length = 32)
    private String prescriptionSource;

    @Column(name = "patient_prescription_external_id")
    private UUID patientPrescriptionExternalId;

    @Column(name = "structured_prescription_external_id")
    private UUID structuredPrescriptionExternalId;

    @Column(name = "child_profile_external_id")
    private UUID childProfileExternalId;

    @Column(name = "child_weight_kg_used", precision = 5, scale = 2)
    private BigDecimal childWeightKgUsed;

    @Column(name = "weight_source", length = 32)
    private String weightSource;

    @Column(name = "overall_risk_level", nullable = false, length = 16)
    private String overallRiskLevel = "none";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "interaction_findings", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> interactionFindings = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "dosage_findings", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> dosageFindings = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "unrecognized_drugs", columnDefinition = "text[]")
    private List<String> unrecognizedDrugs = new ArrayList<>();

    @Column(name = "llm_summary", columnDefinition = "text")
    private String llmSummary;

    @Column(name = "reviewed_by_doctor", nullable = false)
    private boolean reviewedByDoctor = false;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "reviewed_by_user_id", length = 64)
    private String reviewedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

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

    public List<Map<String, Object>> getInteractionFindings() {
        return interactionFindings;
    }

    public void setInteractionFindings(List<Map<String, Object>> interactionFindings) {
        this.interactionFindings = interactionFindings == null ? new ArrayList<>() : interactionFindings;
    }

    public List<Map<String, Object>> getDosageFindings() {
        return dosageFindings;
    }

    public void setDosageFindings(List<Map<String, Object>> dosageFindings) {
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

    public String getReviewedByUserId() {
        return reviewedByUserId;
    }

    public void setReviewedByUserId(String reviewedByUserId) {
        this.reviewedByUserId = reviewedByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
