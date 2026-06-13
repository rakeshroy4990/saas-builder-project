package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class GrowthRecordResponse {

    @JsonProperty("ExternalId")
    private UUID externalId;

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    @JsonProperty("RecordedAt")
    private Instant recordedAt;

    @JsonProperty("RecordedByUserId")
    private String recordedByUserId;

    @JsonProperty("AgeMonthsAtRecording")
    private BigDecimal ageMonthsAtRecording;

    @JsonProperty("HeightCm")
    private BigDecimal heightCm;

    @JsonProperty("WeightKg")
    private BigDecimal weightKg;

    @JsonProperty("HeadCircumferenceCm")
    private BigDecimal headCircumferenceCm;

    @JsonProperty("Bmi")
    private BigDecimal bmi;

    @JsonProperty("HeightPercentile")
    private BigDecimal heightPercentile;

    @JsonProperty("WeightPercentile")
    private BigDecimal weightPercentile;

    @JsonProperty("BmiPercentile")
    private BigDecimal bmiPercentile;

    @JsonProperty("HcPercentile")
    private BigDecimal hcPercentile;

    @JsonProperty("Source")
    private String source;

    @JsonProperty("AppointmentExternalId")
    private UUID appointmentExternalId;

    @JsonProperty("DeviceReadingExternalId")
    private UUID deviceReadingExternalId;

    @JsonProperty("Notes")
    private String notes;

    @JsonProperty("CreatedAt")
    private Instant createdAt;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
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

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
