package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "consultation_transcript")
public class ConsultationTranscriptJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id", nullable = false, unique = true)
    private UUID externalId;

    @Column(name = "consultation_audio_external_id", nullable = false)
    private UUID consultationAudioExternalId;

    @Column(name = "appointment_external_id", nullable = false)
    private UUID appointmentExternalId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "transcript_json", columnDefinition = "jsonb")
    private List<Map<String, Object>> transcriptJson;

    @Column(name = "transcript_text", columnDefinition = "TEXT")
    private String transcriptText;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "structured_json", columnDefinition = "jsonb")
    private Map<String, Object> structuredJson = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "summary_json", columnDefinition = "jsonb")
    private Map<String, Object> summaryJson = new LinkedHashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "soap_json", columnDefinition = "jsonb")
    private Map<String, Object> soapJson = new LinkedHashMap<>();

    @Column(name = "speakers_swapped", nullable = false)
    private boolean speakersSwapped;

    @Column(nullable = false)
    private boolean committed;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public UUID getConsultationAudioExternalId() {
        return consultationAudioExternalId;
    }

    public void setConsultationAudioExternalId(UUID consultationAudioExternalId) {
        this.consultationAudioExternalId = consultationAudioExternalId;
    }

    public UUID getAppointmentExternalId() {
        return appointmentExternalId;
    }

    public void setAppointmentExternalId(UUID appointmentExternalId) {
        this.appointmentExternalId = appointmentExternalId;
    }

    public List<Map<String, Object>> getTranscriptJson() {
        return transcriptJson;
    }

    public void setTranscriptJson(List<Map<String, Object>> transcriptJson) {
        this.transcriptJson = transcriptJson;
    }

    public String getTranscriptText() {
        return transcriptText;
    }

    public void setTranscriptText(String transcriptText) {
        this.transcriptText = transcriptText;
    }

    public Map<String, Object> getStructuredJson() {
        return structuredJson;
    }

    public void setStructuredJson(Map<String, Object> structuredJson) {
        this.structuredJson = structuredJson == null ? new LinkedHashMap<>() : structuredJson;
    }

    public Map<String, Object> getSummaryJson() {
        return summaryJson;
    }

    public void setSummaryJson(Map<String, Object> summaryJson) {
        this.summaryJson = summaryJson == null ? new LinkedHashMap<>() : summaryJson;
    }

    public Map<String, Object> getSoapJson() {
        return soapJson;
    }

    public void setSoapJson(Map<String, Object> soapJson) {
        this.soapJson = soapJson == null ? new LinkedHashMap<>() : soapJson;
    }

    public boolean isSpeakersSwapped() {
        return speakersSwapped;
    }

    public void setSpeakersSwapped(boolean speakersSwapped) {
        this.speakersSwapped = speakersSwapped;
    }

    public boolean isCommitted() {
        return committed;
    }

    public void setCommitted(boolean committed) {
        this.committed = committed;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
