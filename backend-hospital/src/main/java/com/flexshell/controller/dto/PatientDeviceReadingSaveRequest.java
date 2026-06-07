package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Upsert body for {@code POST /api/v1/patient-device-readings/save}.
 * Business key: {@code ExternalId} (optional on create).
 */
public class PatientDeviceReadingSaveRequest {
    @JsonProperty("ExternalId")
    private UUID externalId;
    @JsonProperty("DeviceKey")
    private String deviceKey;
    @JsonProperty("DeviceName")
    private String deviceName;
    @JsonProperty("DeviceType")
    private String deviceType;
    @JsonProperty("Measurements")
    private Map<String, Object> measurements = new LinkedHashMap<>();
    @JsonProperty("RecordedAt")
    private java.time.Instant recordedAt;
    @JsonProperty("RawBytesBase64")
    private String rawBytesBase64;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getDeviceKey() {
        return deviceKey;
    }

    public void setDeviceKey(String deviceKey) {
        this.deviceKey = deviceKey;
    }

    public String getDeviceName() {
        return deviceName;
    }

    public void setDeviceName(String deviceName) {
        this.deviceName = deviceName;
    }

    public String getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(String deviceType) {
        this.deviceType = deviceType;
    }

    public Map<String, Object> getMeasurements() {
        return measurements;
    }

    public void setMeasurements(Map<String, Object> measurements) {
        this.measurements = measurements == null ? new LinkedHashMap<>() : measurements;
    }

    public java.time.Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(java.time.Instant recordedAt) {
        this.recordedAt = recordedAt;
    }

    public String getRawBytesBase64() {
        return rawBytesBase64;
    }

    public void setRawBytesBase64(String rawBytesBase64) {
        this.rawBytesBase64 = rawBytesBase64;
    }

    public PatientDeviceReadingCreateRequest toCreateRequest() {
        return new PatientDeviceReadingCreateRequest(
                deviceKey,
                deviceName,
                deviceType,
                measurements,
                recordedAt,
                rawBytesBase64
        );
    }
}
