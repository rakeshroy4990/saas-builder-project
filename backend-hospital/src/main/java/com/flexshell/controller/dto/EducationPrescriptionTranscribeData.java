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
        @JsonProperty("HospitalName") String hospitalName,
        @JsonProperty("DocumentType") String documentType,
        @JsonProperty("RegistrationNumber") String registrationNumber,
        @JsonProperty("ReceiptNumber") String receiptNumber,
        @JsonProperty("AppointmentDate") String appointmentDate,
        @JsonProperty("PatientName") String patientName,
        @JsonProperty("PatientAge") String patientAge,
        @JsonProperty("PatientGender") String patientGender,
        @JsonProperty("AgeGender") String ageGender,
        @JsonProperty("Department") String department,
        @JsonProperty("Consultant") String consultant,
        @JsonProperty("Address") String address,
        @JsonProperty("MobileNumber") String mobileNumber,
        @JsonProperty("ReferredBy") String referredBy,
        @JsonProperty("Diagnosis") String diagnosis,
        /** Newline-separated medications (education chat). */
        @JsonProperty("Medications") String medications,
        @JsonProperty("Medicines") List<String> medicines,
        @JsonProperty("Dosage") List<String> dosage,
        @JsonProperty("Advice") List<String> advice,
        /** Lab / imaging / culture orders — not medicines. */
        @JsonProperty("Investigations") List<String> investigations,
        @JsonProperty("DoctorName") String doctorName,
        @JsonProperty("PrescriptionDate") String prescriptionDate,
        @JsonProperty("Notes") String notes,
        @JsonProperty("WeightKg") Double weightKg,
        @JsonProperty("TemperatureF") Double temperatureF
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
        investigations = investigations == null ? List.of() : List.copyOf(investigations);
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
        map.put("investigations", new ArrayList<>(investigations));
        map.put("doctor_name", resolvedDoctorName());
        map.put("prescription_date", resolvedPrescriptionDate());
        map.put("notes", notes);
        if (weightKg != null) {
            map.put("weight_kg", weightKg);
        }
        if (temperatureF != null) {
            map.put("temperature_f", temperatureF);
        }
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

    public EducationPrescriptionTranscribeData withVitals(Double weightKg, Double temperatureF) {
        return new EducationPrescriptionTranscribeData(
                hospitalName,
                documentType,
                registrationNumber,
                receiptNumber,
                appointmentDate,
                patientName,
                patientAge,
                patientGender,
                ageGender,
                department,
                consultant,
                address,
                mobileNumber,
                referredBy,
                diagnosis,
                medications,
                medicines,
                dosage,
                advice,
                investigations,
                doctorName,
                prescriptionDate,
                notes,
                weightKg != null ? weightKg : this.weightKg,
                temperatureF != null ? temperatureF : this.temperatureF
        );
    }

    public EducationPrescriptionTranscribeData withClinicalLines(
            List<String> medicines,
            List<String> dosage,
            List<String> advice,
            List<String> investigations,
            String medications
    ) {
        return new EducationPrescriptionTranscribeData(
                hospitalName,
                documentType,
                registrationNumber,
                receiptNumber,
                appointmentDate,
                patientName,
                patientAge,
                patientGender,
                ageGender,
                department,
                consultant,
                address,
                mobileNumber,
                referredBy,
                diagnosis,
                medications,
                medicines == null ? List.of() : medicines,
                dosage == null ? List.of() : dosage,
                advice == null ? List.of() : advice,
                investigations == null ? List.of() : investigations,
                doctorName,
                prescriptionDate,
                notes,
                weightKg,
                temperatureF
        );
    }

    /** @deprecated Use {@link #toSearchText()} — embeddings must not include demographics or admin fields. */
    @Deprecated
    public String toEmbeddingText() {
        return toSearchText();
    }
}
