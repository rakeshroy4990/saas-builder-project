package com.flexshell.prescription;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StructuredPrescriptionValidatorTest {

    @Test
    void rejectsEmptyPayload() {
        assertFalse(StructuredPrescriptionValidator.validate(null).isEmpty());
    }

    @Test
    void acceptsMinimalValidPayload() {
        Map<String, Object> payload = validPayload();
        assertTrue(StructuredPrescriptionValidator.validate(payload).isEmpty());
    }

    @Test
    void blocksH1ScheduleCategory() {
        Map<String, Object> payload = validPayload();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> meds = (List<Map<String, Object>>) payload.get(ClinicTelemedicinePrescriptionSchema.KEY_MEDICINES);
        meds.get(0).put(ClinicTelemedicinePrescriptionSchema.KEY_MED_SCHEDULE_CATEGORY, "H1");
        List<String> errors = StructuredPrescriptionValidator.validate(payload);
        assertTrue(errors.stream().anyMatch(s -> s.contains("H1")));
    }

    private static Map<String, Object> validPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_TEMPLATE_VERSION, ClinicTelemedicinePrescriptionSchema.TEMPLATE_VERSION);
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_DATE_TIME, "2026-04-18T10:00:00Z");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_MODE, "VIDEO");
        Map<String, Object> clinic = new LinkedHashMap<>();
        clinic.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_NAME, "Clinic");
        clinic.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_ADDRESS, "Addr");
        clinic.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_PHONE, "999");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_CLINIC, clinic);
        Map<String, Object> prescriber = new LinkedHashMap<>();
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_DISPLAY_NAME, "Dr X");
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_QUALIFICATIONS, "MBBS");
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_NAME, "SMC");
        prescriber.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_REGISTRATION, "123");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER, prescriber);
        Map<String, Object> patient = new LinkedHashMap<>();
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_NAME, "Pat");
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_AGE_OR_DOB, "40");
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_SEX, "F");
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_ADDRESS, "Home");
        patient.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_PHONE, "888");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_PATIENT, patient);
        Map<String, Object> med = new LinkedHashMap<>();
        med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_NAME, "Paracetamol");
        med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_STRENGTH, "500mg");
        med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_DOSE, "1");
        med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_FREQUENCY, "TDS");
        med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_ROUTE, "Oral");
        med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_DURATION_DAYS, "5");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_MEDICINES, List.of(med));
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_GENERAL_ADVICE, "");
        payload.put(ClinicTelemedicinePrescriptionSchema.KEY_FOLLOW_UP_ADVICE, "Review in 1 week");
        return payload;
    }
}
