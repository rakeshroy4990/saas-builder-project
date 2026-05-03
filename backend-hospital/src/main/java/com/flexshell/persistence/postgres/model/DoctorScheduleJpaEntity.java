package com.flexshell.persistence.postgres.model;

import com.flexshell.doctorschedule.DoctorScheduleDay;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "doctor_schedules")
public class DoctorScheduleJpaEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "doctor_id", nullable = false, unique = true, length = 64)
    private String doctorId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "weekly", nullable = false, columnDefinition = "jsonb")
    private Map<String, DoctorScheduleDay> weekly = new LinkedHashMap<>();

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(nullable = false)
    private boolean deleted = false;

    @PrePersist
    void prePersist() {
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        if (weekly == null) {
            weekly = new LinkedHashMap<>();
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

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }

    public Map<String, DoctorScheduleDay> getWeekly() {
        return weekly;
    }

    public void setWeekly(Map<String, DoctorScheduleDay> weekly) {
        this.weekly = weekly == null ? new LinkedHashMap<>() : weekly;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
