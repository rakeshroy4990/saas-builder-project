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

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "patient_device_readings")
public class PatientDeviceReadingJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "patient_user_id", nullable = false, length = 64)
    private String patientUserId;

    @Column(name = "device_key", nullable = false, length = 64)
    private String deviceKey;

    @Column(name = "device_name", length = 128)
    private String deviceName;

    @Column(name = "device_type", nullable = false, length = 32)
    private String deviceType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "measurements", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> measurements = new LinkedHashMap<>();

    @Column(name = "raw_bytes")
    private byte[] rawBytes;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "child_profile_external_id")
    private UUID childProfileExternalId;

    @Column(name = "appointment_external_id")
    private UUID appointmentExternalId;

    @Column(name = "recorded_by_user_id", length = 64)
    private String recordedByUserId;

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
    }

    public Long getId() {
        return id;
    }

    public UUID getExternalId() {
        return externalId;
    }

    public String getPatientUserId() {
        return patientUserId;
    }

    public void setPatientUserId(String patientUserId) {
        this.patientUserId = patientUserId;
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

    public byte[] getRawBytes() {
        return rawBytes;
    }

    public void setRawBytes(byte[] rawBytes) {
        this.rawBytes = rawBytes;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(Instant recordedAt) {
        this.recordedAt = recordedAt;
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

    public UUID getChildProfileExternalId() {
        return childProfileExternalId;
    }

    public void setChildProfileExternalId(UUID childProfileExternalId) {
        this.childProfileExternalId = childProfileExternalId;
    }

    public UUID getAppointmentExternalId() {
        return appointmentExternalId;
    }

    public void setAppointmentExternalId(UUID appointmentExternalId) {
        this.appointmentExternalId = appointmentExternalId;
    }

    public String getRecordedByUserId() {
        return recordedByUserId;
    }

    public void setRecordedByUserId(String recordedByUserId) {
        this.recordedByUserId = recordedByUserId;
    }
}
