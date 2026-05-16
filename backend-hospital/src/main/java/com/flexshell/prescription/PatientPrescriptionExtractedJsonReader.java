package com.flexshell.prescription;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.PatientPrescriptionSimilarityDetailsResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Reads structured clinical fields from {@code patient_prescriptions.extracted_data} JSONB.
 */
public final class PatientPrescriptionExtractedJsonReader {

    private PatientPrescriptionExtractedJsonReader() {
    }

    public static PatientPrescriptionSimilarityDetailsResponse read(ObjectMapper objectMapper, String extractedJson) {
        if (objectMapper == null || extractedJson == null || extractedJson.isBlank()) {
            return PatientPrescriptionSimilarityDetailsResponse.empty();
        }
        try {
            JsonNode root = objectMapper.readTree(extractedJson);
            if (root == null || root.isNull() || !root.isObject()) {
                return PatientPrescriptionSimilarityDetailsResponse.empty();
            }
            String diagnosis = text(root, "diagnosis", "Diagnosis");
            List<String> medicines = stringList(root, "medicines", "Medicines");
            if (medicines.isEmpty()) {
                medicines = splitLines(text(root, "medications", "Medications"));
            }
            List<String> dosage = stringList(root, "dosage", "Dosage");
            List<String> advice = stringList(root, "advice", "Advice");
            String notes = text(root, "notes", "Notes");
            return new PatientPrescriptionSimilarityDetailsResponse(
                    diagnosis,
                    List.copyOf(medicines),
                    List.copyOf(dosage),
                    List.copyOf(advice),
                    notes
            );
        } catch (Exception ignored) {
            return PatientPrescriptionSimilarityDetailsResponse.empty();
        }
    }

    private static String text(JsonNode root, String... keys) {
        for (String key : keys) {
            JsonNode node = root.get(key);
            if (node != null && !node.isNull()) {
                String value = node.asText("").trim();
                if (!value.isBlank() && !isNotStated(value)) {
                    return value;
                }
            }
        }
        return "";
    }

    private static List<String> stringList(JsonNode root, String... keys) {
        for (String key : keys) {
            JsonNode node = root.get(key);
            if (node == null || node.isNull()) {
                continue;
            }
            if (node.isArray()) {
                List<String> items = new ArrayList<>();
                for (JsonNode entry : node) {
                    String value = entry.asText("").trim();
                    if (!value.isBlank() && !isNotStated(value)) {
                        items.add(value);
                    }
                }
                if (!items.isEmpty()) {
                    return items;
                }
            }
            String asText = node.asText("").trim();
            List<String> split = splitLines(asText);
            if (!split.isEmpty()) {
                return split;
            }
        }
        return List.of();
    }

    private static List<String> splitLines(String raw) {
        String text = Objects.toString(raw, "").trim();
        if (text.isBlank() || isNotStated(text)) {
            return List.of();
        }
        String[] lines = text.split("\\r?\\n");
        List<String> items = new ArrayList<>();
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isBlank() && !isNotStated(trimmed)) {
                items.add(trimmed);
            }
        }
        if (!items.isEmpty()) {
            return items;
        }
        if (text.contains(",")) {
            for (String part : text.split(",")) {
                String trimmed = part.trim();
                if (!trimmed.isBlank() && !isNotStated(trimmed)) {
                    items.add(trimmed);
                }
            }
        }
        if (items.isEmpty()) {
            items.add(text);
        }
        return items;
    }

    private static boolean isNotStated(String value) {
        return "not stated".equals(value.trim().toLowerCase(Locale.ROOT));
    }
}
