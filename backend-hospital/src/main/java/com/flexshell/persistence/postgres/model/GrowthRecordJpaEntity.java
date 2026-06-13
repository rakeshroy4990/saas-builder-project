package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "growth_records")
public class GrowthRecordJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "child_profile_external_id", nullable = false)
    private UUID childProfileExternalId;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "recorded_by_user_id", length = 64)
    private String recordedByUserId;

    @Column(name = "age_months_at_recording", nullable = false, precision = 6, scale = 2)
    private BigDecimal ageMonthsAtRecording;

    @Column(name = "height_cm", precision = 5, scale = 2)
    private BigDecimal heightCm;

    @Column(name = "weight_kg", precision = 5, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "head_circumference_cm", precision = 5, scale = 2)
    private BigDecimal headCircumferenceCm;

    @Column(precision = 5, scale = 2)
    private BigDecimal bmi;

    @Column(name = "height_percentile", precision = 5, scale = 2)
    private BigDecimal heightPercentile;

    @Column(name = "weight_percentile", precision = 5, scale = 2)
    private BigDecimal weightPercentile;

    @Column(name = "bmi_percentile", precision = 5, scale = 2)
    private BigDecimal bmiPercentile;

    @Column(name = "hc_percentile", precision = 5, scale = 2)
    private BigDecimal hcPercentile;

    @Column(nullable = false, length = 32)
    private String source;

    @Column(name = "appointment_external_id")
    private UUID appointmentExternalId;

    @Column(name = "device_reading_external_id")
    private UUID deviceReadingExternalId;

    @Column
    private String notes;

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
        if (recordedAt == null) {
            recordedAt = createdAt;
        }
        if (source == null || source.isBlank()) {
            source = "manual";
        }
    }

    public Long getId() {
        return id;
    }

    public UUID getExternalId() {
        return externalId;
    }

    public UUID getChildProfileExternalId() {
        return childProfileExternalId;
    }

    public void setChildProfileExternalId(UUID childProfileExternalId) {
        this.childProfileExternalId = childProfileExternalId;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    public String getRecordedByUserId() {
        return recordedByUserId;
    }

    public void setRecordedByUserId(String recordedByUserId) {
        this.recordedByUserId = recordedByUserId;
    }

    public BigDecimal getAgeMonthsAtRecording() {
        return ageMonthsAtRecording;
    }

    public void setAgeMonthsAtRecording(BigDecimal ageMonthsAtRecording) {
        this.ageMonthsAtRecording = ageMonthsAtRecording;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(BigDecimal heightCm) {
        this.heightCm = heightCm;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public BigDecimal getHeadCircumferenceCm() {
        return headCircumferenceCm;
    }

    public void setHeadCircumferenceCm(BigDecimal headCircumferenceCm) {
        this.headCircumferenceCm = headCircumferenceCm;
    }

    public BigDecimal getBmi() {
        return bmi;
    }

    public void setBmi(BigDecimal bmi) {
        this.bmi = bmi;
    }

    public BigDecimal getHeightPercentile() {
        return heightPercentile;
    }

    public void setHeightPercentile(BigDecimal heightPercentile) {
        this.heightPercentile = heightPercentile;
    }

    public BigDecimal getWeightPercentile() {
        return weightPercentile;
    }

    public void setWeightPercentile(BigDecimal weightPercentile) {
        this.weightPercentile = weightPercentile;
    }

    public BigDecimal getBmiPercentile() {
        return bmiPercentile;
    }

    public void setBmiPercentile(BigDecimal bmiPercentile) {
        this.bmiPercentile = bmiPercentile;
    }

    public BigDecimal getHcPercentile() {
        return hcPercentile;
    }

    public void setHcPercentile(BigDecimal hcPercentile) {
        this.hcPercentile = hcPercentile;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public UUID getAppointmentExternalId() {
        return appointmentExternalId;
    }

    public void setAppointmentExternalId(UUID appointmentExternalId) {
        this.appointmentExternalId = appointmentExternalId;
    }

    public UUID getDeviceReadingExternalId() {
        return deviceReadingExternalId;
    }

    public void setDeviceReadingExternalId(UUID deviceReadingExternalId) {
        this.deviceReadingExternalId = deviceReadingExternalId;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
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
