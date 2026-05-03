package com.flexshell.persistence.postgres.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "appointments")
public class AppointmentJpaEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "patient_name")
    private String patientName;

    private String email;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Column(name = "age_group")
    private String ageGroup;

    private String department;

    @Column(name = "doctor_id")
    private String doctorId;

    @Column(name = "doctor_name")
    private String doctorName;

    @Column(name = "preferred_date")
    private String preferredDate;

    @Column(name = "preferred_time_slot")
    private String preferredTimeSlot;

    @Column(name = "additional_notes")
    private String additionalNotes;

    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "prescription_files", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> prescriptionFiles = new ArrayList<>();

    @Column(name = "created_at")
    private Instant createdTimestamp;

    @Column(name = "updated_at")
    private Instant updatedTimestamp;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "appointment_email_notify_status")
    private String appointmentEmailNotifyStatus;

    @Column(name = "appointment_email_notify_failed")
    private Boolean appointmentEmailNotifyFailed;

    @Column(name = "appointment_email_notify_detail")
    private String appointmentEmailNotifyDetail;

    @Column(name = "appointment_email_notify_at")
    private Instant appointmentEmailNotifyAt;

    @Column(name = "call_status")
    private String callStatus;

    @Column(name = "call_start_time")
    private Instant callStartTime;

    @Column(name = "call_end_time")
    private Instant callEndTime;

    @Column(nullable = false)
    private boolean deleted = false;

    @PrePersist
    void prePersist() {
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        if (prescriptionFiles == null) {
            prescriptionFiles = new ArrayList<>();
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

    public String getPatientName() {
        return patientName;
    }

    public void setPatientName(String patientName) {
        this.patientName = patientName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getAgeGroup() {
        return ageGroup;
    }

    public void setAgeGroup(String ageGroup) {
        this.ageGroup = ageGroup;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getDoctorId() {
        return doctorId;
    }

    public void setDoctorId(String doctorId) {
        this.doctorId = doctorId;
    }

    public String getDoctorName() {
        return doctorName;
    }

    public void setDoctorName(String doctorName) {
        this.doctorName = doctorName;
    }

    public String getPreferredDate() {
        return preferredDate;
    }

    public void setPreferredDate(String preferredDate) {
        this.preferredDate = preferredDate;
    }

    public String getPreferredTimeSlot() {
        return preferredTimeSlot;
    }

    public void setPreferredTimeSlot(String preferredTimeSlot) {
        this.preferredTimeSlot = preferredTimeSlot;
    }

    public String getAdditionalNotes() {
        return additionalNotes;
    }

    public void setAdditionalNotes(String additionalNotes) {
        this.additionalNotes = additionalNotes;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<Map<String, Object>> getPrescriptionFiles() {
        return prescriptionFiles;
    }

    public void setPrescriptionFiles(List<Map<String, Object>> prescriptionFiles) {
        this.prescriptionFiles = prescriptionFiles != null ? prescriptionFiles : new ArrayList<>();
    }

    public Instant getCreatedTimestamp() {
        return createdTimestamp;
    }

    public void setCreatedTimestamp(Instant createdTimestamp) {
        this.createdTimestamp = createdTimestamp;
    }

    public Instant getUpdatedTimestamp() {
        return updatedTimestamp;
    }

    public void setUpdatedTimestamp(Instant updatedTimestamp) {
        this.updatedTimestamp = updatedTimestamp;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public String getAppointmentEmailNotifyStatus() {
        return appointmentEmailNotifyStatus;
    }

    public void setAppointmentEmailNotifyStatus(String appointmentEmailNotifyStatus) {
        this.appointmentEmailNotifyStatus = appointmentEmailNotifyStatus;
    }

    public Boolean getAppointmentEmailNotifyFailed() {
        return appointmentEmailNotifyFailed;
    }

    public void setAppointmentEmailNotifyFailed(Boolean appointmentEmailNotifyFailed) {
        this.appointmentEmailNotifyFailed = appointmentEmailNotifyFailed;
    }

    public String getAppointmentEmailNotifyDetail() {
        return appointmentEmailNotifyDetail;
    }

    public void setAppointmentEmailNotifyDetail(String appointmentEmailNotifyDetail) {
        this.appointmentEmailNotifyDetail = appointmentEmailNotifyDetail;
    }

    public Instant getAppointmentEmailNotifyAt() {
        return appointmentEmailNotifyAt;
    }

    public void setAppointmentEmailNotifyAt(Instant appointmentEmailNotifyAt) {
        this.appointmentEmailNotifyAt = appointmentEmailNotifyAt;
    }

    public String getCallStatus() {
        return callStatus;
    }

    public void setCallStatus(String callStatus) {
        this.callStatus = callStatus;
    }

    public Instant getCallStartTime() {
        return callStartTime;
    }

    public void setCallStartTime(Instant callStartTime) {
        this.callStartTime = callStartTime;
    }

    public Instant getCallEndTime() {
        return callEndTime;
    }

    public void setCallEndTime(Instant callEndTime) {
        this.callEndTime = callEndTime;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
