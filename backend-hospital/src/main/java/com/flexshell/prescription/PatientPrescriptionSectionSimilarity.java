package com.flexshell.prescription;

import com.flexshell.controller.dto.PatientPrescriptionSimilarityDetailsResponse;
import com.flexshell.controller.dto.PatientPrescriptionSimilaritySectionScoreResponse;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Per-section text extraction and cosine scoring for prescription similarity breakdown.
 */
public final class PatientPrescriptionSectionSimilarity {

    public static final String SECTION_DIAGNOSIS = "diagnosis";
    public static final String SECTION_MEDICINES = "medicines";
    public static final String SECTION_DOSAGE = "dosage";
    public static final String SECTION_ADVICE = "advice";
    public static final String SECTION_NOTES = "notes";

    private static final List<String> SECTION_ORDER = List.of(
            SECTION_DIAGNOSIS,
            SECTION_MEDICINES,
            SECTION_DOSAGE,
            SECTION_ADVICE,
            SECTION_NOTES
    );

    private static final Pattern DIAGNOSIS_BLOCK = Pattern.compile(
            "(?is)diagnosis\\s*:?\\s*(.+?)(?=\\n\\s*(?:medications?|medicines?)\\s*:|$)"
    );
    private static final Pattern MEDICINES_BLOCK = Pattern.compile(
            "(?is)(?:medications?|medicines?)\\s*:?\\s*(.+?)$"
    );

    private PatientPrescriptionSectionSimilarity() {
    }

    public static PatientPrescriptionSimilarityDetailsResponse fromTranscribe(EducationPrescriptionTranscribeData data) {
        if (data == null) {
            return PatientPrescriptionSimilarityDetailsResponse.empty();
        }
        String diagnosis = trimClinical(data.diagnosis());
        List<String> medicines = new ArrayList<>(data.medicines() == null ? List.of() : data.medicines());
        if (medicines.isEmpty()) {
            String meds = trimClinical(data.medications());
            if (!meds.isBlank()) {
                for (String line : meds.split("\\n+")) {
                    String t = line.trim();
                    if (!t.isBlank()) {
                        medicines.add(t);
                    }
                }
            }
        }
        return new PatientPrescriptionSimilarityDetailsResponse(
                diagnosis,
                List.copyOf(medicines),
                List.copyOf(data.dosage() == null ? List.of() : data.dosage()),
                List.copyOf(data.advice() == null ? List.of() : data.advice()),
                trimClinical(data.notes())
        );
    }

    public static PatientPrescriptionSimilarityDetailsResponse parseQueryText(String rawQuery) {
        String text = Objects.toString(rawQuery, "").trim();
        if (text.isBlank()) {
            return PatientPrescriptionSimilarityDetailsResponse.empty();
        }
        String diagnosis = "";
        String medications = "";
        Matcher dMatch = DIAGNOSIS_BLOCK.matcher(text);
        if (dMatch.find()) {
            diagnosis = trimClinical(dMatch.group(1));
        }
        Matcher mMatch = MEDICINES_BLOCK.matcher(text);
        if (mMatch.find()) {
            medications = trimClinical(mMatch.group(1));
        }
        if (!diagnosis.isBlank() || !medications.isBlank()) {
            return new PatientPrescriptionSimilarityDetailsResponse(
                    diagnosis,
                    List.copyOf(splitClinicalListItems(medications)),
                    List.of(),
                    List.of(),
                    ""
            );
        }
        return parseFlatClinicalSearchText(text);
    }

    /**
     * Parses query text produced by {@link com.flexshell.prescription.PatientPrescriptionSearchTextBuilder}
     * and the education transcribe similarity helper: {@code diagnosis. medicine1, medicine2. dosage. notes}.
     */
    static PatientPrescriptionSimilarityDetailsResponse parseFlatClinicalSearchText(String text) {
        String trimmed = trimClinical(text);
        if (trimmed.isBlank()) {
            return PatientPrescriptionSimilarityDetailsResponse.empty();
        }
        String[] segments = trimmed.split("\\.\\s+");
        if (segments.length <= 1) {
            return new PatientPrescriptionSimilarityDetailsResponse(trimmed, List.of(), List.of(), List.of(), "");
        }
        String diagnosis = trimClinical(segments[0]);
        List<String> medicines = List.copyOf(splitClinicalListItems(segments[1]));
        List<String> dosage = segments.length > 2
                ? List.copyOf(splitClinicalListItems(segments[2]))
                : List.of();
        String notes = "";
        if (segments.length > 3) {
            StringBuilder noteBuilder = new StringBuilder(trimClinical(segments[3]));
            for (int i = 4; i < segments.length; i++) {
                String part = trimClinical(segments[i]);
                if (!part.isBlank()) {
                    if (!noteBuilder.isEmpty()) {
                        noteBuilder.append(". ");
                    }
                    noteBuilder.append(part);
                }
            }
            notes = noteBuilder.toString();
        }
        return new PatientPrescriptionSimilarityDetailsResponse(
                diagnosis,
                medicines,
                dosage,
                List.of(),
                notes
        );
    }

    private static List<String> splitClinicalListItems(String raw) {
        String block = trimClinical(raw);
        if (block.isBlank()) {
            return List.of();
        }
        String[] lines = block.split("\\r?\\n");
        List<String> items = new ArrayList<>();
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isBlank()) {
                items.add(trimmed);
            }
        }
        if (items.size() > 1) {
            return items;
        }
        if (block.contains(",")) {
            items.clear();
            for (String part : block.split(",")) {
                String trimmed = part.trim();
                if (!trimmed.isBlank()) {
                    items.add(trimmed);
                }
            }
        }
        if (items.isEmpty()) {
            items.add(block);
        }
        return items;
    }

    public static Map<String, String> sectionEmbedTexts(PatientPrescriptionSimilarityDetailsResponse details) {
        Map<String, String> map = new LinkedHashMap<>();
        if (details == null) {
            return map;
        }
        putIfPresent(map, SECTION_DIAGNOSIS, details.diagnosis());
        putIfPresent(map, SECTION_MEDICINES, joinList(details.medicines()));
        putIfPresent(map, SECTION_DOSAGE, joinList(details.dosage()));
        putIfPresent(map, SECTION_ADVICE, joinList(details.advice()));
        putIfPresent(map, SECTION_NOTES, details.notes());
        return map;
    }

    public static double cosineSimilarityPercent(List<Double> a, List<Double> b) {
        if (a == null || b == null || a.size() != b.size() || a.isEmpty()) {
            return 0.0;
        }
        double dot = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < a.size(); i++) {
            double av = a.get(i);
            double bv = b.get(i);
            dot += av * bv;
            normA += av * av;
            normB += bv * bv;
        }
        if (normA <= 0.0 || normB <= 0.0) {
            return 0.0;
        }
        double cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
        double clamped = Math.max(0.0, Math.min(1.0, cosine));
        return clamped * 100.0;
    }

    private static void putIfPresent(Map<String, String> map, String key, String value) {
        String t = trimClinical(value);
        if (!t.isBlank()) {
            map.put(key, t);
        }
    }

    private static String joinList(List<String> items) {
        if (items == null || items.isEmpty()) {
            return "";
        }
        List<String> cleaned = new ArrayList<>();
        for (String item : items) {
            String t = trimClinical(item);
            if (!t.isBlank()) {
                cleaned.add(t);
            }
        }
        return cleaned.isEmpty() ? "" : String.join(", ", cleaned);
    }

    private static String trimClinical(String raw) {
        String t = Objects.toString(raw, "").trim();
        if (t.isBlank() || "not stated".equalsIgnoreCase(t) || "[illegible]".equalsIgnoreCase(t)) {
            return "";
        }
        return t;
    }
}
