package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "patient_prescription_groups")
public class PatientPrescriptionGroupJpaEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "patient_user_id", nullable = false, length = 64)
    private String patientUserId;

    @Column
    private String label;

    @Column(name = "group_type")
    private String groupType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean deleted = false;

    @PrePersist
    void prePersist() {
        if (id == null || id.isBlank()) {
            id = UUID.randomUUID().toString();
        }
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getPatientUserId() {
        return patientUserId;
    }

    public void setPatientUserId(String patientUserId) {
        this.patientUserId = patientUserId;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getGroupType() {
        return groupType;
    }

    public void setGroupType(String groupType) {
        this.groupType = groupType;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
