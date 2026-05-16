package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.flexshell.prescription.PatientPrescriptionSearchTextBuilder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Structured prescription / OPD card extract from vision/LLM (education UI + patient upload storage).
 */
public record EducationPrescriptionTranscribeData(
        @JsonProperty("hospital_name") String hospitalName,
        @JsonProperty("document_type") String documentType,
        @JsonProperty("registration_number") String registrationNumber,
        @JsonProperty("receipt_number") String receiptNumber,
        @JsonProperty("appointment_date") String appointmentDate,
        @JsonProperty("patient_name") String patientName,
        @JsonProperty("patient_age") String patientAge,
        @JsonProperty("patient_gender") String patientGender,
        @JsonProperty("age_gender") String ageGender,
        @JsonProperty("department") String department,
        @JsonProperty("consultant") String consultant,
        @JsonProperty("address") String address,
        @JsonProperty("mobile_number") String mobileNumber,
        @JsonProperty("referred_by") String referredBy,
        @JsonProperty("diagnosis") String diagnosis,
        /** Newline-separated medications (education chat). */
        @JsonProperty("medications") String medications,
        @JsonProperty("medicines") List<String> medicines,
        @JsonProperty("dosage") List<String> dosage,
        @JsonProperty("advice") List<String> advice,
        @JsonProperty("doctor_name") String doctorName,
        @JsonProperty("prescription_date") String prescriptionDate,
        @JsonProperty("notes") String notes
) {
    public EducationPrescriptionTranscribeData {
        hospitalName = trim(hospitalName);
        documentType = trim(documentType);
        registrationNumber = trim(registrationNumber);
        receiptNumber = trim(receiptNumber);
        appointmentDate = trim(appointmentDate);
        patientName = trim(patientName);
        patientAge = trim(patientAge);
        patientGender = trim(patientGender);
        ageGender = trim(ageGender);
        department = trim(department);
        consultant = trim(consultant);
        address = trim(address);
        mobileNumber = trim(mobileNumber);
        referredBy = trim(referredBy);
        diagnosis = trim(diagnosis);
        medications = trim(medications);
        medicines = medicines == null ? List.of() : List.copyOf(medicines);
        dosage = dosage == null ? List.of() : List.copyOf(dosage);
        advice = advice == null ? List.of() : List.copyOf(advice);
        doctorName = trim(doctorName);
        prescriptionDate = trim(prescriptionDate);
        notes = trim(notes);
    }

    private static String trim(String value) {
        return Objects.toString(value, "").trim();
    }

    /** Full shape stored in {@code patient_prescriptions.extracted_data} (JSONB). */
    public Map<String, Object> toExtractedDataMap() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("hospital_name", hospitalName);
        map.put("document_type", documentType);
        map.put("registration_number", registrationNumber);
        map.put("receipt_number", receiptNumber);
        map.put("appointment_date", appointmentDate);
        map.put("patient_name", patientName);
        map.put("patient_age", patientAge);
        map.put("patient_gender", patientGender);
        map.put("age_gender", ageGender);
        map.put("department", department);
        map.put("consultant", consultant);
        map.put("address", address);
        map.put("mobile_number", mobileNumber);
        map.put("referred_by", referredBy);
        map.put("diagnosis", diagnosis);
        map.put("medicines", new ArrayList<>(medicines));
        map.put("dosage", new ArrayList<>(dosage));
        map.put("advice", new ArrayList<>(advice));
        map.put("doctor_name", resolvedDoctorName());
        map.put("prescription_date", resolvedPrescriptionDate());
        map.put("notes", notes);
        return map;
    }

    public String resolvedDoctorName() {
        if (!doctorName.isBlank()) {
            return doctorName;
        }
        return consultant;
    }

    public String resolvedPrescriptionDate() {
        if (!prescriptionDate.isBlank()) {
            return prescriptionDate;
        }
        return appointmentDate;
    }

    /**
     * Clinical-only text for {@code patient_prescriptions.search_text} and embeddings.
     * Includes: diagnosis, medicines, dosage, clinical notes (excludes doctor, dates, hospital, admin footers).
     */
    public String toSearchText() {
        return PatientPrescriptionSearchTextBuilder.build(this);
    }

    /** @deprecated Use {@link #toSearchText()} — embeddings must not include demographics or admin fields. */
    @Deprecated
    public String toEmbeddingText() {
        return toSearchText();
    }
}
