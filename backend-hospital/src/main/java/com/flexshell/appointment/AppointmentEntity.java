package com.flexshell.appointment;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Document(collection = "appointment")
public class AppointmentEntity {
    @Id
    private String id;

    @Field("PatientName")
    private String patientName;

    @Field("Email")
    private String email;

    @Field("PhoneNumber")
    private String phoneNumber;

    @Field("AgeGroup")
    private String ageGroup;

    @Field("Department")
    private String department;

    @Field("DoctorId")
    private String doctorId;

    @Field("DoctorName")
    private String doctorName;

    @Field("PreferredDate")
    private String preferredDate;

    @Field("PreferredTimeSlot")
    private String preferredTimeSlot;

    @Field("AdditionalNotes")
    private String additionalNotes;

    @Field("Status")
    private String status;

    @Field("PrescriptionFiles")
    private List<AppointmentFile> prescriptionFiles = new ArrayList<>();

    @Field("CreatedTimestamp")
    private Instant createdTimestamp;

    @Field("UpdatedTimestamp")
    private Instant updatedTimestamp;

    @Field("CreatedBy")
    private String createdBy;

    @Field("UpdatedBy")
    private String updatedBy;

    /** SKIPPED | SUCCESS | PARTIAL | FAILED — outcome of post-create appointment emails. */
    @Field("AppointmentEmailNotifyStatus")
    private String appointmentEmailNotifyStatus = "PENDING";

    /** True when any attempted recipient send failed or the notify HTTP call failed. */
    @Field("AppointmentEmailNotifyFailed")
    private Boolean appointmentEmailNotifyFailed = Boolean.FALSE;

    /** Short diagnostic (e.g. provider error); truncated when persisting. */
    @Field("AppointmentEmailNotifyDetail")
    private String appointmentEmailNotifyDetail;

    @Field("AppointmentEmailNotifyAt")
    private Instant appointmentEmailNotifyAt;

    /** Video call state: CALL_INITIATED, CALL_IN_PROGRESS, CALL_ENDED, … (see {@link AppointmentCallStates}). */
    @Field("CallStatus")
    private String callStatus;

    @Field("CallStartTime")
    private Instant callStartTime;

    @Field("CallEndTime")
    private Instant callEndTime;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public List<AppointmentFile> getPrescriptionFiles() {
        return prescriptionFiles;
    }

    public void setPrescriptionFiles(List<AppointmentFile> prescriptionFiles) {
        this.prescriptionFiles = prescriptionFiles;
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

    public static class AppointmentFile {
        @Field("FileId")
        private String fileId = UUID.randomUUID().toString();
        @Field("FileName")
        private String fileName;
        @Field("ContentType")
        private String contentType;
        @Field("Size")
        private long size;
        @Field("Data")
        private byte[] data;

        public String getFileId() {
            return fileId;
        }

        public void setFileId(String fileId) {
            this.fileId = fileId;
        }

        public String getFileName() {
            return fileName;
        }

        public void setFileName(String fileName) {
            this.fileName = fileName;
        }

        public String getContentType() {
            return contentType;
        }

        public void setContentType(String contentType) {
            this.contentType = contentType;
        }

        public long getSize() {
            return size;
        }

        public void setSize(long size) {
            this.size = size;
        }

        public byte[] getData() {
            return data;
        }

        public void setData(byte[] data) {
            this.data = data;
        }
    }
}
