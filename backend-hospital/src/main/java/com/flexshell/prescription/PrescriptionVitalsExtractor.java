package com.flexshell.prescription;

import com.fasterxml.jackson.databind.JsonNode;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Extracts pediatric vitals (weight, temperature, age) from OPD / prescription transcription.
 */
public final class PrescriptionVitalsExtractor {

    private static final List<Pattern> WEIGHT_PATTERNS = List.of(
            Pattern.compile("(?i)\\b(?:wt|weight)\\s*\\.?\\s*[-–:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*k?g\\b"),
            Pattern.compile("(?i)\\b(?:wt|weight)\\s*[-–:=]\\s*(\\d+(?:\\.\\d+)?)\\b"),
            Pattern.compile("(?i)\\bweight\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*k?g\\b")
    );

    private static final List<Pattern> TEMPERATURE_PATTERNS = List.of(
            Pattern.compile("(?i)\\b(?:temp(?:erature)?)\\s*\\.?\\s*[-–:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:°\\s*)?[fc](?:ahrenheit|elsius)?\\b"),
            Pattern.compile("(?i)(?:^|\\s)T\\s*[-–:=]\\s*(\\d+(?:\\.\\d+)?)\\s*(?:°\\s*)?[fc]?\\b"),
            Pattern.compile("(?i)\\bfever\\s*[-–:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:°\\s*)?f\\b")
    );

    private static final Pattern AGE_YMD = Pattern.compile(
            "(?i)(\\d+)\\s*y(?:\\s*(\\d+)\\s*m)?(?:\\s*(\\d+)\\s*d)?");

    private PrescriptionVitalsExtractor() {
    }

    public record PrescriptionVitals(Double weightKg, Double temperatureF, Double ageMonths) {
    }

    public static PrescriptionVitals fromTranscribe(EducationPrescriptionTranscribeData data) {
        if (data == null) {
            return new PrescriptionVitals(null, null, null);
        }
        Double weightKg = data.weightKg();
        Double temperatureF = data.temperatureF();
        String textBlob = allTranscribedText(data);
        if (weightKg == null) {
            weightKg = parseWeightKg(textBlob);
        }
        if (temperatureF == null) {
            temperatureF = parseTemperatureF(textBlob);
        }
        Double ageMonths = parseAgeMonths(firstNonBlank(data.patientAge(), data.ageGender()));
        return new PrescriptionVitals(weightKg, temperatureF, ageMonths);
    }

    private static final Pattern SUMMARY_AGE_LINE = Pattern.compile("(?im)^Age\\s*:\\s*(.+)$");

    /** Scan arbitrary text blobs (e.g. raw PDF layer, full model JSON, or doctor summary). */
    public static PrescriptionVitals fromAnyText(String... blobs) {
        String combined = java.util.stream.Stream.of(blobs)
                .map(s -> Objects.toString(s, "").trim())
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining("\n"));
        if (combined.isBlank()) {
            return new PrescriptionVitals(null, null, null);
        }
        Double ageMonths = null;
        Matcher ageLine = SUMMARY_AGE_LINE.matcher(combined);
        if (ageLine.find()) {
            ageMonths = parseAgeMonths(ageLine.group(1).trim());
        }
        return new PrescriptionVitals(parseWeightKg(combined), parseTemperatureF(combined), ageMonths);
    }

    public static PrescriptionVitals merge(PrescriptionVitals primary, PrescriptionVitals supplement) {
        if (primary == null) {
            return supplement == null ? new PrescriptionVitals(null, null, null) : supplement;
        }
        if (supplement == null) {
            return primary;
        }
        return new PrescriptionVitals(
                firstNonNullDouble(primary.weightKg(), supplement.weightKg()),
                firstNonNullDouble(primary.temperatureF(), supplement.temperatureF()),
                firstNonNullDouble(primary.ageMonths(), supplement.ageMonths())
        );
    }

    /** Parse vitals-only vision JSON ({@code weight_kg}, {@code temperature_f}, {@code vitals}). */
    public static PrescriptionVitals fromVitalsModelJson(String rawJson, com.fasterxml.jackson.databind.ObjectMapper mapper) {
        String cleaned = stripJsonFences(Objects.toString(rawJson, "").trim());
        if (cleaned.isBlank()) {
            return new PrescriptionVitals(null, null, null);
        }
        try {
            JsonNode root = mapper.readTree(cleaned);
            Double weightKg = readNumericField(root, "weight_kg", "weightKg", "WeightKg");
            Double temperatureF = readNumericField(root, "temperature_f", "temperatureF", "TemperatureF", "temp_f");
            String vitalsText = readTextField(root, "vitals", "vital_signs");
            String flat = flattenJsonText(root);
            PrescriptionVitals fromText = fromAnyText(flat, vitalsText, cleaned);
            return new PrescriptionVitals(
                    firstNonNullDouble(weightKg, fromText.weightKg()),
                    firstNonNullDouble(temperatureF, fromText.temperatureF()),
                    null
            );
        } catch (Exception ex) {
            return fromAnyText(cleaned);
        }
    }

    private static Double firstNonNullDouble(Double a, Double b) {
        return a != null ? a : b;
    }

    private static Double readNumericField(JsonNode root, String... keys) {
        for (String key : keys) {
            JsonNode node = findChildIgnoreCase(root, key);
            if (node == null || node.isNull()) {
                continue;
            }
            if (node.isNumber()) {
                return node.doubleValue();
            }
            String text = node.asText("").trim();
            if (!text.isBlank()) {
                try {
                    return Double.parseDouble(text.replaceAll("[^\\d.]", ""));
                } catch (NumberFormatException ignored) {
                    // fall through
                }
            }
        }
        return null;
    }

    private static String readTextField(JsonNode root, String... keys) {
        for (String key : keys) {
            JsonNode node = findChildIgnoreCase(root, key);
            if (node != null && node.isTextual()) {
                return node.asText("").trim();
            }
        }
        return "";
    }

    private static JsonNode findChildIgnoreCase(JsonNode object, String key) {
        if (object == null || !object.isObject()) {
            return null;
        }
        java.util.Iterator<Map.Entry<String, JsonNode>> it = object.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> entry = it.next();
            if (entry.getKey().equalsIgnoreCase(key)) {
                return entry.getValue();
            }
        }
        return null;
    }

    private static String stripJsonFences(String raw) {
        String trimmed = raw.trim();
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n');
            int end = trimmed.lastIndexOf("```");
            if (start >= 0 && end > start) {
                return trimmed.substring(start + 1, end).trim();
            }
        }
        return trimmed;
    }

    /** Collect every string/number value from model JSON — catches vitals in unmapped keys. */
    public static String flattenJsonText(JsonNode root) {
        if (root == null || root.isNull()) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        appendJsonText(parts, root);
        return parts.stream()
                .map(s -> Objects.toString(s, "").trim())
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining("\n"));
    }

    private static void appendJsonText(List<String> parts, JsonNode node) {
        if (node == null || node.isNull()) {
            return;
        }
        if (node.isTextual() || node.isNumber()) {
            parts.add(node.asText());
            return;
        }
        if (node.isArray()) {
            for (JsonNode item : node) {
                appendJsonText(parts, item);
            }
            return;
        }
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> appendJsonText(parts, entry.getValue()));
        }
    }

    public static EducationPrescriptionTranscribeData enrich(EducationPrescriptionTranscribeData data) {
        if (data == null) {
            return null;
        }
        PrescriptionVitals vitals = fromTranscribe(data);
        if (Objects.equals(data.weightKg(), vitals.weightKg())
                && Objects.equals(data.temperatureF(), vitals.temperatureF())) {
            return data;
        }
        return copyWithVitals(data, vitals.weightKg(), vitals.temperatureF());
    }

    static Double parseWeightKg(String text) {
        String raw = Objects.toString(text, "");
        if (raw.isBlank()) {
            return null;
        }
        for (Pattern pattern : WEIGHT_PATTERNS) {
            Matcher matcher = pattern.matcher(raw);
            if (matcher.find()) {
                return Double.parseDouble(matcher.group(1));
            }
        }
        return null;
    }

    static Double parseTemperatureF(String text) {
        String raw = Objects.toString(text, "");
        if (raw.isBlank()) {
            return null;
        }
        for (Pattern pattern : TEMPERATURE_PATTERNS) {
            Matcher matcher = pattern.matcher(raw);
            if (matcher.find()) {
                return Double.parseDouble(matcher.group(1));
            }
        }
        return null;
    }

    static Double parseAgeMonths(String ageText) {
        String raw = Objects.toString(ageText, "").trim();
        if (raw.isBlank()) {
            return null;
        }
        Matcher matcher = AGE_YMD.matcher(raw);
        if (!matcher.find()) {
            return null;
        }
        int years = Integer.parseInt(matcher.group(1));
        int months = matcher.group(2) == null ? 0 : Integer.parseInt(matcher.group(2));
        return years * 12.0 + months;
    }

    static String allTranscribedText(EducationPrescriptionTranscribeData data) {
        List<String> parts = new ArrayList<>();
        parts.add(data.diagnosis());
        parts.add(data.notes());
        parts.add(data.medications());
        parts.addAll(data.medicines());
        parts.addAll(data.dosage());
        parts.addAll(data.advice());
        parts.addAll(data.investigations());
        appendMapValues(parts, data.toExtractedDataMap());
        return parts.stream()
                .map(s -> Objects.toString(s, "").trim())
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining("\n"));
    }

    private static void appendMapValues(List<String> parts, Map<String, Object> map) {
        if (map == null || map.isEmpty()) {
            return;
        }
        for (Object value : map.values()) {
            if (value instanceof String s) {
                parts.add(s);
            } else if (value instanceof List<?> list) {
                for (Object item : list) {
                    if (item != null) {
                        parts.add(item.toString());
                    }
                }
            } else if (value instanceof Number num) {
                parts.add(num.toString());
            }
        }
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private static EducationPrescriptionTranscribeData copyWithVitals(
            EducationPrescriptionTranscribeData data,
            Double weightKg,
            Double temperatureF
    ) {
        return new EducationPrescriptionTranscribeData(
                data.hospitalName(),
                data.documentType(),
                data.registrationNumber(),
                data.receiptNumber(),
                data.appointmentDate(),
                data.patientName(),
                data.patientAge(),
                data.patientGender(),
                data.ageGender(),
                data.department(),
                data.consultant(),
                data.address(),
                data.mobileNumber(),
                data.referredBy(),
                data.diagnosis(),
                data.medications(),
                data.medicines(),
                data.dosage(),
                data.advice(),
                data.investigations(),
                data.doctorName(),
                data.prescriptionDate(),
                data.notes(),
                weightKg,
                temperatureF
        );
    }
}
