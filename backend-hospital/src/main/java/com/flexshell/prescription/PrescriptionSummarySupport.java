package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Formats transcribed OPD/prescription data for doctor review and parses edited summary text
 * back into structured medication rows for safety validation.
 */
public final class PrescriptionSummarySupport {

    private static final Pattern MEDICINES_SECTION = Pattern.compile(
            "(?is)\\bMedicines\\s*:\\s*(.*?)(?=\\n\\s*(?:Investigations|Advice|Notes)\\s*:|\\z)"
    );

    private PrescriptionSummarySupport() {
    }

    public static String formatDoctorSummary(EducationPrescriptionTranscribeData data) {
        if (data == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        appendLine(sb, "Patient", firstNonBlank(data.patientName(), "—"));
        appendLine(sb, "Age", firstNonBlank(data.patientAge(), data.ageGender(), "—"));
        appendLine(sb, "Gender", firstNonBlank(data.patientGender(), "—"));
        if (data.weightKg() != null) {
            appendLine(sb, "Weight", data.weightKg() + " kg");
        }
        if (data.temperatureF() != null) {
            appendLine(sb, "Temperature", data.temperatureF() + " °F");
        }
        if (!data.diagnosis().isBlank()) {
            sb.append("\nDiagnosis:\n").append(data.diagnosis().trim()).append('\n');
        }
        sb.append("\nMedicines:\n");
        List<String> medicines = data.medicines() == null ? List.of() : data.medicines();
        if (medicines.isEmpty() && !data.medications().isBlank()) {
            for (String line : data.medications().split("\\r?\\n")) {
                String trimmed = line.trim();
                if (!trimmed.isBlank()) {
                    sb.append(trimmed).append('\n');
                }
            }
        } else {
            for (String line : medicines) {
                if (line != null && !line.isBlank()) {
                    sb.append(line.trim()).append('\n');
                }
            }
        }
        List<String> investigations = data.investigations() == null ? List.of() : data.investigations();
        if (!investigations.isEmpty()) {
            sb.append("\nInvestigations:\n");
            for (String line : investigations) {
                if (line != null && !line.isBlank()) {
                    sb.append(line.trim()).append('\n');
                }
            }
        }
        List<String> advice = data.advice() == null ? List.of() : data.advice();
        if (!advice.isEmpty()) {
            sb.append("\nAdvice:\n");
            for (String line : advice) {
                if (line != null && !line.isBlank()) {
                    sb.append(line.trim()).append('\n');
                }
            }
        }
        return sb.toString().trim();
    }

    public static Map<String, Object> toExtractedDataMap(String summary) {
        Map<String, Object> map = new LinkedHashMap<>();
        String raw = Objects.toString(summary, "").trim();
        if (raw.isBlank()) {
            map.put("medicines", List.of());
            return map;
        }
        List<String> medicines = parseMedicineLines(raw);
        map.put("medicines", medicines);
        map.put("medications", String.join("\n", medicines));
        PrescriptionVitalsExtractor.PrescriptionVitals vitals = PrescriptionVitalsExtractor.fromAnyText(raw);
        if (vitals.weightKg() != null) {
            map.put("weight_kg", vitals.weightKg());
        }
        if (vitals.temperatureF() != null) {
            map.put("temperature_f", vitals.temperatureF());
        }
        Matcher diagnosis = Pattern.compile("(?is)\\bDiagnosis\\s*:\\s*(.*?)(?=\\n\\s*Medicines\\s*:|\\z)")
                .matcher(raw);
        if (diagnosis.find()) {
            map.put("diagnosis", diagnosis.group(1).trim());
        }
        return map;
    }

    public static List<String> parseMedicineLines(String summary) {
        String raw = Objects.toString(summary, "").trim();
        if (raw.isBlank()) {
            return List.of();
        }
        Matcher section = MEDICINES_SECTION.matcher(raw);
        String block = section.find() ? section.group(1).trim() : raw;
        List<String> lines = new ArrayList<>();
        for (String line : block.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) {
                continue;
            }
            if (isSectionHeader(trimmed)) {
                break;
            }
            lines.add(trimmed);
        }
        return lines;
    }

    private static boolean isSectionHeader(String line) {
        String lower = line.toLowerCase(Locale.ROOT);
        return lower.startsWith("investigations:")
                || lower.startsWith("advice:")
                || lower.startsWith("notes:")
                || lower.startsWith("diagnosis:");
    }

    private static void appendLine(StringBuilder sb, String label, String value) {
        if (value == null || value.isBlank() || "—".equals(value)) {
            return;
        }
        sb.append(label).append(": ").append(value.trim()).append('\n');
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }
}
