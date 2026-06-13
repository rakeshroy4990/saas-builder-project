package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class GrowthRecordSaveRequest {

    @JsonProperty("ExternalId")
    private UUID externalId;

    @JsonProperty("ChildProfileExternalId")
    private UUID childProfileExternalId;

    @JsonProperty("RecordedAt")
    private Instant recordedAt;

    @JsonProperty("HeightCm")
    private BigDecimal heightCm;

    @JsonProperty("WeightKg")
    private BigDecimal weightKg;

    @JsonProperty("HeadCircumferenceCm")
    private BigDecimal headCircumferenceCm;

    @JsonProperty("Source")
    private String source;

    @JsonProperty("AppointmentExternalId")
    private UUID appointmentExternalId;

    @JsonProperty("DeviceReadingExternalId")
    private UUID deviceReadingExternalId;

    @JsonProperty("Notes")
    private String notes;

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
}
