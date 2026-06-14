package com.flexshell.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.prescription.PrescriptionClinicalLineClassifier;
import com.flexshell.prescription.PrescriptionVitalsExtractor;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Parses LLM JSON into {@link EducationPrescriptionTranscribeData} (full OPD / prescription schema).
 */
final class PrescriptionExtractionJsonParser {

    private PrescriptionExtractionJsonParser() {
    }

    static EducationPrescriptionTranscribeData fromJson(JsonNode root) {
        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("PRESCRIPTION_MODEL_JSON_INVALID");
        }

        String hospitalName = pickStringField(root, "hospital_name", "hospitalName");
        String documentType = pickStringField(root, "document_type", "documentType");
        String registrationNumber = pickStringField(root, "registration_number", "registrationNumber", "reg_no");
        String receiptNumber = pickStringField(root, "receipt_number", "receiptNumber");
        String appointmentDate = pickStringField(root, "appointment_date", "appointmentDate");
        String patientName = pickStringField(root, "patient_name", "patientName");
        String patientAge = pickStringField(root, "patient_age", "patientAge");
        String patientGender = pickStringField(root, "patient_gender", "patientGender");
        String ageGender = pickStringField(root, "age_gender", "ageGender");
        String department = pickStringField(root, "department");
        String consultant = pickStringField(root, "consultant");
        String address = pickStringField(root, "address");
        String mobileNumber = pickStringField(root, "mobile_number", "mobileNumber", "mobile");
        String referredBy = pickStringField(root, "referred_by", "referredBy");

        String diagnosis = pickStringField(root, "diagnosis");
        String medicationsBlob = pickStringField(root, "medications");
        List<String> medicines = pickStringArrayField(root, "medicines");
        List<String> dosage = pickStringArrayField(root, "dosage");
        List<String> advice = pickStringArrayField(root, "advice");
        List<String> investigations = pickStringArrayField(root, "investigations", "labs", "lab_tests", "labTests");
        String doctorName = firstNonBlank(
                pickStringField(root, "doctor_name", "doctorName"),
                consultant
        );
        String prescriptionDate = firstNonBlank(
                pickStringField(root, "prescription_date", "prescriptionDate"),
                appointmentDate
        );
        String notes = pickStringField(root, "notes");
        String textBlob = pickStringField(root, "text");
        Double weightKg = pickDoubleField(root, "weight_kg", "weightKg", "WeightKg");
        Double temperatureF = pickDoubleField(root, "temperature_f", "temperatureF", "TemperatureF", "temp_f");

        diagnosis = mergeClinicalText(
                diagnosis,
                pickStringField(root, "symptoms", "chief_complaint", "history", "history_of_present_illness"),
                pickStringField(root, "examination", "examination_findings", "physical_examination", "physical_exam"),
                pickStringField(root, "vitals", "vital_signs")
        );
        notes = mergeClinicalText(
                notes,
                pickStringField(root, "vitals", "vital_signs"),
                pickStringField(root, "examination", "examination_findings")
        );

        if (diagnosis.isBlank() && medicationsBlob.isBlank() && medicines.isEmpty() && !textBlob.isBlank()) {
            EducationPrescriptionTranscribeData fromText =
                    EducationPrescriptionTranscriptionService.extractDiagnosisMedicationsFromPlainText(textBlob);
            diagnosis = fromText.diagnosis();
            medicationsBlob = fromText.medications();
            medicines = fromText.medicines();
        } else if (!textBlob.isBlank()) {
            EducationPrescriptionTranscribeData fromText =
                    EducationPrescriptionTranscriptionService.extractDiagnosisMedicationsFromPlainText(textBlob);
            if (diagnosis.isBlank()) {
                diagnosis = fromText.diagnosis();
            }
            if (medicationsBlob.isBlank() && medicines.isEmpty()) {
                medicationsBlob = fromText.medications();
                medicines = fromText.medicines();
            }
        }

        if (medicines.isEmpty() && !medicationsBlob.isBlank()) {
            medicines = splitLines(medicationsBlob);
        }
        String medications = medicationsBlob;
        if (medications.isBlank() && !medicines.isEmpty()) {
            medications = String.join("\n", medicines);
        }

        weightKg = firstNonNullDouble(weightKg, pickVitalsObjectDouble(root, "weight_kg", "weightKg", "weight", "wt"));
        temperatureF = firstNonNullDouble(
                temperatureF,
                pickVitalsObjectDouble(root, "temperature_f", "temperatureF", "temperature", "temp", "t")
        );

        String flattenedJson = PrescriptionVitalsExtractor.flattenJsonText(root);
        PrescriptionVitalsExtractor.PrescriptionVitals fromJsonText =
                PrescriptionVitalsExtractor.fromAnyText(flattenedJson, diagnosis, notes, textBlob);
        weightKg = firstNonNullDouble(weightKg, fromJsonText.weightKg());
        temperatureF = firstNonNullDouble(temperatureF, fromJsonText.temperatureF());

        if (weightKg != null && PrescriptionVitalsExtractor.fromAnyText(diagnosis).weightKg() == null) {
            diagnosis = diagnosis.isBlank()
                    ? "wt - " + weightKg + " kg"
                    : diagnosis + "\nwt - " + weightKg + " kg";
        }
        if (temperatureF != null && PrescriptionVitalsExtractor.fromAnyText(diagnosis).temperatureF() == null) {
            diagnosis = diagnosis + "\nT - " + temperatureF + " F";
        }

        return PrescriptionClinicalLineClassifier.reclassify(new EducationPrescriptionTranscribeData(
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
                weightKg,
                temperatureF
        ));
    }

    private static String mergeClinicalText(String... parts) {
        List<String> lines = new ArrayList<>();
        for (String part : parts) {
            String trimmed = Objects.toString(part, "").trim();
            if (!trimmed.isBlank()) {
                lines.add(trimmed);
            }
        }
        return String.join("\n", lines);
    }

    private static Double firstNonNullDouble(Double primary, Double fallback) {
        return primary != null ? primary : fallback;
    }

    private static Double pickVitalsObjectDouble(JsonNode root, String... keys) {
        boolean weightField = java.util.Arrays.stream(keys).anyMatch(
                k -> k.toLowerCase().contains("weight") || "wt".equalsIgnoreCase(k)
        );
        for (String containerKey : List.of("vitals", "vital_signs", "examination", "examination_findings")) {
            JsonNode container = findChildIgnoreCase(root, containerKey);
            if (container == null || !container.isObject()) {
                continue;
            }
            Double value = pickDoubleField(container, keys);
            if (value != null) {
                return value;
            }
            String text = pickStringField(container, keys);
            if (!text.isBlank()) {
                PrescriptionVitalsExtractor.PrescriptionVitals fromText = PrescriptionVitalsExtractor.fromAnyText(text);
                Double parsed = weightField ? fromText.weightKg() : fromText.temperatureF();
                if (parsed != null) {
                    return parsed;
                }
            }
        }
        return null;
    }

    private static JsonNode findChildIgnoreCase(JsonNode object, String key) {
        if (object == null || !object.isObject()) {
            return null;
        }
        Iterator<Map.Entry<String, JsonNode>> it = object.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> entry = it.next();
            if (entry.getKey().equalsIgnoreCase(key)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static Double pickDoubleField(JsonNode object, String... keys) {
        for (String key : keys) {
            Iterator<Map.Entry<String, JsonNode>> it = object.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                if (!e.getKey().equalsIgnoreCase(key)) {
                    continue;
                }
                JsonNode v = e.getValue();
                if (v == null || v.isNull()) {
                    return null;
                }
                if (v.isNumber()) {
                    return v.doubleValue();
                }
                String s = v.asText("").trim();
                if (s.isBlank()) {
                    return null;
                }
                try {
                    return Double.parseDouble(s.replaceAll("[^\\d.]", ""));
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return "";
    }

    private static List<String> splitLines(String raw) {
        String text = Objects.toString(raw, "").trim();
        if (text.isBlank()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.isBlank()) {
                lines.add(trimmed);
            }
        }
        return lines.isEmpty() ? List.of(text) : lines;
    }

    private static String pickStringField(JsonNode object, String... keys) {
        for (String key : keys) {
            Iterator<Map.Entry<String, JsonNode>> it = object.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                if (!e.getKey().equalsIgnoreCase(key)) {
                    continue;
                }
                JsonNode v = e.getValue();
                if (v == null || v.isNull()) {
                    return "";
                }
                if (v.isTextual() || v.isNumber()) {
                    String s = v.asText("").trim();
                    if (!s.isBlank()) {
                        return s;
                    }
                } else if (v.isArray()) {
                    String joined = joinArrayAsLines(v);
                    if (!joined.isBlank()) {
                        return joined;
                    }
                } else {
                    String s = v.toString().trim();
                    if (!s.isBlank()) {
                        return s;
                    }
                }
            }
        }
        return "";
    }

    private static List<String> pickStringArrayField(JsonNode object, String... keys) {
        for (String key : keys) {
            Iterator<Map.Entry<String, JsonNode>> it = object.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                if (!e.getKey().equalsIgnoreCase(key)) {
                    continue;
                }
                JsonNode v = e.getValue();
                if (v == null || v.isNull()) {
                    return List.of();
                }
                if (v.isArray()) {
                    return jsonArrayToStrings(v);
                }
                if (v.isTextual()) {
                    return splitLines(v.asText(""));
                }
                return List.of(v.toString().trim());
            }
        }
        return List.of();
    }

    private static List<String> jsonArrayToStrings(JsonNode array) {
        List<String> out = new ArrayList<>();
        for (JsonNode item : array) {
            if (item == null || item.isNull()) {
                continue;
            }
            if (item.isObject()) {
                String compact = compactObjectLine(item);
                if (!compact.isBlank()) {
                    out.add(compact);
                }
                continue;
            }
            String s = item.isTextual() || item.isNumber() ? item.asText("").trim() : item.toString().trim();
            if (!s.isBlank()) {
                out.add(s);
            }
        }
        return out;
    }

    private static String compactObjectLine(JsonNode object) {
        String name = pickStringField(object, "name", "medicine", "drug");
        String instructions = pickStringField(object, "instructions", "instruction", "dosage", "frequency");
        if (!name.isBlank() && !instructions.isBlank()) {
            return name + ": " + instructions;
        }
        return name.isBlank() ? instructions : name;
    }

    private static String joinArrayAsLines(JsonNode array) {
        List<String> parts = jsonArrayToStrings(array);
        return parts.isEmpty() ? "" : String.join("\n", parts);
    }
}
