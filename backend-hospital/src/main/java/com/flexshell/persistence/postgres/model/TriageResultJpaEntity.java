package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
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
@Table(name = "triage_results")
public class TriageResultJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "appointment_external_id")
    private UUID appointmentExternalId;

    @Column(name = "patient_user_id", nullable = false, length = 64)
    private String patientUserId;

    @Column(name = "child_display_name")
    private String childDisplayName;

    @Column(name = "child_age_months", nullable = false)
    private int childAgeMonths;

    @Column(name = "child_weight_kg", precision = 5, scale = 2)
    private BigDecimal childWeightKg;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "reported_symptoms", columnDefinition = "text[]", nullable = false)
    private String[] reportedSymptoms = new String[0];

    @Column(name = "symptom_duration_hours")
    private Integer symptomDurationHours;

    @Column(name = "symptom_severity", nullable = false, length = 16)
    private String symptomSeverity;

    @Column(name = "additional_notes")
    private String additionalNotes;

    @Column(name = "urgency_level", nullable = false, length = 16)
    private String urgencyLevel;

    @Column(name = "urgency_reasoning", nullable = false)
    private String urgencyReasoning;

    @Column(name = "doctor_note", nullable = false)
    private String doctorNote;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "red_flags", columnDefinition = "text[]", nullable = false)
    private String[] redFlags = new String[0];

    @Column(length = 16)
    private String confidence;

    @Column(name = "model_used")
    private String modelUsed;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rag_chunks_used", columnDefinition = "jsonb")
    private List<Map<String, Object>> ragChunksUsed = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean deleted;

    @PrePersist
    void prePersist() {
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public UUID getExternalId() {
        return externalId;
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

    public String[] getReportedSymptoms() {
        return reportedSymptoms;
    }

    public void setReportedSymptoms(String[] reportedSymptoms) {
        this.reportedSymptoms = reportedSymptoms == null ? new String[0] : reportedSymptoms;
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

    public String[] getRedFlags() {
        return redFlags;
    }

    public void setRedFlags(String[] redFlags) {
        this.redFlags = redFlags == null ? new String[0] : redFlags;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
