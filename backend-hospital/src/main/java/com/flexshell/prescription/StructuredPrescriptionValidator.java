package com.flexshell.prescription;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class StructuredPrescriptionValidator {

    private StructuredPrescriptionValidator() {}

    public static List<String> validate(Map<String, Object> payload) {
        List<String> errors = new ArrayList<>();
        if (payload == null || payload.isEmpty()) {
            errors.add("Payload is required");
            return errors;
        }
        requireNonBlank(payload, ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_DATE_TIME, errors);
        requireNonBlank(payload, ClinicTelemedicinePrescriptionSchema.KEY_CONSULTATION_MODE, errors);

        Map<String, Object> clinic = childMap(payload, ClinicTelemedicinePrescriptionSchema.KEY_CLINIC);
        requireNonBlank(clinic, ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_NAME, "clinic.name", errors);
        requireNonBlank(clinic, ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_ADDRESS, "clinic.address", errors);
        requireNonBlank(clinic, ClinicTelemedicinePrescriptionSchema.KEY_CLINIC_PHONE, "clinic.phone", errors);

        Map<String, Object> prescriber = childMap(payload, ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER);
        requireNonBlank(prescriber, ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_DISPLAY_NAME, "prescriber.displayName", errors);
        requireNonBlank(prescriber, ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_QUALIFICATIONS, "prescriber.qualifications", errors);
        requireNonBlank(prescriber, ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_NAME, "prescriber.smcName", errors);
        requireNonBlank(prescriber, ClinicTelemedicinePrescriptionSchema.KEY_PRESCRIBER_SMC_REGISTRATION, "prescriber.smcRegistrationNumber", errors);

        Map<String, Object> patient = childMap(payload, ClinicTelemedicinePrescriptionSchema.KEY_PATIENT);
        requireNonBlank(patient, ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_NAME, "patient.name", errors);
        requireNonBlank(patient, ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_AGE_OR_DOB, "patient.ageOrDob", errors);
        requireNonBlank(patient, ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_SEX, "patient.sex", errors);
        requireNonBlank(patient, ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_ADDRESS, "patient.address", errors);
        requireNonBlank(patient, ClinicTelemedicinePrescriptionSchema.KEY_PATIENT_PHONE, "patient.phone", errors);

        Object meds = payload.get(ClinicTelemedicinePrescriptionSchema.KEY_MEDICINES);
        if (!(meds instanceof List<?> list) || list.isEmpty()) {
            errors.add("medicines must contain at least one line item");
        } else {
            int i = 0;
            for (Object row : list) {
                if (!(row instanceof Map<?, ?> m)) {
                    errors.add("medicines[" + i + "] must be an object");
                    i++;
                    continue;
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> med = (Map<String, Object>) m;
                requireNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_NAME, "medicines[" + i + "].name", errors);
                requireNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_STRENGTH, "medicines[" + i + "].strength", errors);
                requireNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_DOSE, "medicines[" + i + "].dose", errors);
                requireNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_FREQUENCY, "medicines[" + i + "].frequency", errors);
                requireNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_ROUTE, "medicines[" + i + "].route", errors);
                requireNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_DURATION_DAYS, "medicines[" + i + "].durationDays", errors);
                String sched = str(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_SCHEDULE_CATEGORY));
                if (!sched.isBlank()) {
                    String u = sched.trim().toUpperCase(Locale.ROOT);
                    if ("H1".equals(u) || "X".equals(u)) {
                        errors.add("medicines[" + i + "].scheduleCategory=" + u
                                + " is blocked pending counsel-approved controlled-drug workflow");
                    }
                }
                i++;
            }
        }
        return errors;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> childMap(Map<String, Object> payload, String key) {
        Object v = payload.get(key);
        if (v instanceof Map<?, ?> m) {
            return (Map<String, Object>) m;
        }
        return Map.of();
    }

    private static void requireNonBlank(Map<String, Object> map, String key, List<String> errors) {
        requireNonBlank(map, key, key, errors);
    }

    private static void requireNonBlank(Map<String, Object> map, String key, String path, List<String> errors) {
        if (str(map.get(key)).isBlank()) {
            errors.add(path + " is required");
        }
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
