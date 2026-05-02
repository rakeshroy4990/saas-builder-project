package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record AppointmentResponse(
        @JsonProperty("Id")
        String id,
        @JsonProperty("PatientName")
        String patientName,
        @JsonProperty("Email")
        String email,
        @JsonProperty("PhoneNumber")
        String phoneNumber,
        @JsonProperty("AgeGroup")
        String ageGroup,
        @JsonProperty("Department")
        String department,
        @JsonProperty("DoctorId")
        String doctorId,
        @JsonProperty("DoctorName")
        String doctorName,
        @JsonProperty("PreferredDate")
        String preferredDate,
        @JsonProperty("PreferredTimeSlot")
        String preferredTimeSlot,
        @JsonProperty("Status")
        String status,
        @JsonProperty("AdditionalNotes")
        String additionalNotes,
        @JsonProperty("PrescriptionFiles")
        List<AppointmentFileResponse> prescriptionFiles,
        @JsonProperty("CreatedTimestamp")
        String createdTimestamp,
        @JsonProperty("UpdatedTimestamp")
        String updatedTimestamp,
        @JsonProperty("CreatedBy")
        String createdBy,
        @JsonProperty("UpdatedBy")
        String updatedBy,
        @JsonProperty("AppointmentEmailNotifyStatus")
        String appointmentEmailNotifyStatus,
        @JsonProperty("AppointmentEmailNotifyFailed")
        Boolean appointmentEmailNotifyFailed,
        @JsonProperty("AppointmentEmailNotifyDetail")
        String appointmentEmailNotifyDetail,
        @JsonProperty("AppointmentEmailNotifyAt")
        String appointmentEmailNotifyAt,
        @JsonProperty("CallStatus")
        String callStatus,
        @JsonProperty("CallStartTime")
        String callStartTime,
        @JsonProperty("CallEndTime")
        String callEndTime
) {
}
