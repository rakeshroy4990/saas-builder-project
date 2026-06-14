package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Separates lab investigations from medicines after vision/LLM transcription, and normalizes
 * Indian prescription abbreviations (Syp., Tab., etc.) for drug-catalog lookup.
 */
public final class PrescriptionClinicalLineClassifier {

    /** Numbered lists, bullets, and arrows common on handwritten OPD cards (e.g. {@code 1) Inj …}, {@code -> Syrp …}). */
    private static final Pattern LEADING_LINE_NOISE = Pattern.compile(
            "(?is)^\\s*(?:"
                    + "(?:\\d+\\s*[.)]\\s*)"
                    + "|(?:[-–—•*>]+\\s*)"
                    + "|(?:->|→)\\s*"
                    + ")+"
    );

    private static final Pattern MEDICATION_FORM_PREFIX = Pattern.compile(
            "(?i)^\\s*(?:syp\\.?|syrp\\.?|syr\\.?|syrup|tab\\.?|cap\\.?|susp\\.?|suspension|"
                    + "inj\\.?|inj(?:ection)?|drops?|oint\\.?|cream|gel|dt\\.?|sachet|sach\\.?|powder|granules)\\s+"
    );

    private static final Pattern TRAILING_DOSE_INSTRUCTION = Pattern.compile(
            "(?i)\\s+(?:\\d+(?:\\.\\d+)?\\s*ml\\b.*|(?:sos|prn|stat)\\b.*)$"
    );

    private static final Pattern INLINE_DOSE_TAIL = Pattern.compile(
            "(?i)(\\d+(?:\\.\\d+)?\\s*ml\\b.*|(?:sos|prn|stat)\\b.*(?:if\\b.*)?)$"
    );

    private static final Pattern INVESTIGATION_LINE = Pattern.compile(
            "(?i)(?:"
                    + "\\b(?:throat|nasal|wound|pus|urethral|vaginal|rectal|stool|sputum|blood|urine|semen)\\s+swab\\b"
                    + "|\\bswab\\b.*\\b(?:qs|culture|sensitivity|cs)\\b"
                    + "|\\b(?:stool|sputum|urine|blood|serum|plasma)\\s+(?:r/?e|culture|cs|examination|exam)\\b"
                    + "|\\b(?:cbc|cbil|esr|lp|lft|kft|rft|tft|ppbs|fbs|hba1c|crp|rf|aso|widal|typhidot)\\b"
                    + "|\\b(?:x[- ]?ray|xray|usg|ultrasound|ecg|ekg|ct\\s|mri|echo|doppler)\\b"
                    + "|\\b(?:culture|sensitivity|biopsy|serology|titre|titer|antigen|antibody)\\b"
                    + "|\\b(?:investigation|lab(?:oratory)?\\s+test)\\b"
                    + "|\\bqs\\s*$"
                    + ")"
    );

    private static final Pattern ORAL_REHYDRATION = Pattern.compile(
            "(?i)(?:\\bors\\b|oral\\s+rehydrat|rehydration\\s+sachet|oral\\s+rachet|oral\\s+sachet)"
    );

    private PrescriptionClinicalLineClassifier() {
    }

    /**
     * Moves misclassified lab/investigation lines out of {@code medicines} into {@code investigations}.
     */
    public static EducationPrescriptionTranscribeData reclassify(EducationPrescriptionTranscribeData data) {
        if (data == null) {
            return null;
        }
        List<String> medicines = new ArrayList<>(data.medicines());
        List<String> investigations = new ArrayList<>(data.investigations());
        List<String> advice = new ArrayList<>(data.advice());
        List<String> dosage = new ArrayList<>(data.dosage());

        Set<String> seenInvestigations = new LinkedHashSet<>(investigations);
        List<String> keptMedicines = new ArrayList<>();
        List<String> keptDosage = new ArrayList<>();

        for (int i = 0; i < medicines.size(); i++) {
            String line = Objects.toString(medicines.get(i), "").trim();
            if (line.isBlank()) {
                continue;
            }
            String dosageLine = i < dosage.size() ? Objects.toString(dosage.get(i), "").trim() : "";
            if (looksLikeInvestigation(line, dosageLine)) {
                if (seenInvestigations.add(line)) {
                    investigations.add(line);
                }
                continue;
            }
            keptMedicines.add(line);
            keptDosage.add(dosageLine);
        }

        String medicationsBlob = data.medications();
        if (!keptMedicines.isEmpty()) {
            medicationsBlob = String.join("\n", keptMedicines);
        }

        if (medicines.equals(keptMedicines)
                && investigations.equals(data.investigations())
                && advice.equals(data.advice())
                && dosage.equals(keptDosage)
                && medicationsBlob.equals(data.medications())) {
            return data;
        }

        return data.withClinicalLines(keptMedicines, keptDosage, advice, investigations, medicationsBlob);
    }

    public static boolean looksLikeInvestigation(String line) {
        return looksLikeInvestigation(line, "");
    }

    static boolean looksLikeInvestigation(String line, String dosageLine) {
        String raw = stripLeadingClinicalNoise(Objects.toString(line, "").trim());
        if (raw.isBlank()) {
            return false;
        }
        if (MEDICATION_FORM_PREFIX.matcher(raw).lookingAt()) {
            return false;
        }
        if (ORAL_REHYDRATION.matcher(raw).find()) {
            return false;
        }
        String combined = raw + " " + Objects.toString(dosageLine, "");
        return INVESTIGATION_LINE.matcher(combined).find();
    }

    /**
     * Removes list markers and arrows so formulation prefixes match lines like {@code 1) Inj Hapibev}.
     */
    public static String stripLeadingClinicalNoise(String line) {
        String raw = Objects.toString(line, "").trim();
        if (raw.isBlank()) {
            return "";
        }
        Matcher noise = LEADING_LINE_NOISE.matcher(raw);
        if (noise.lookingAt()) {
            raw = raw.substring(noise.end()).trim();
        }
        return raw;
    }

    /**
     * Strips formulation prefixes and trailing instructions so drug_reference matching can resolve
     * e.g. {@code Syp Advent 457} → {@code Advent 457}.
     */
    public static String normalizeDrugNameForLookup(String line) {
        String raw = stripLeadingClinicalNoise(Objects.toString(line, "").trim());
        if (raw.isBlank()) {
            return "";
        }
        if (ORAL_REHYDRATION.matcher(raw).find()) {
            return "ORS";
        }
        String name = raw;
        int paren = name.indexOf('(');
        if (paren > 0) {
            name = name.substring(0, paren).trim();
        }
        int colon = name.indexOf(':');
        if (colon > 0 && colon < 40) {
            String after = name.substring(colon + 1).trim();
            if (!after.isBlank() && !looksLikeInvestigation(after)) {
                name = name.substring(0, colon).trim();
            }
        }
        Matcher prefix = MEDICATION_FORM_PREFIX.matcher(name);
        if (prefix.lookingAt()) {
            name = name.substring(prefix.end()).trim();
        }
        Matcher trailingDose = TRAILING_DOSE_INSTRUCTION.matcher(name);
        if (trailingDose.find()) {
            name = name.substring(0, trailingDose.start()).trim();
        }
        name = name.replaceAll("(?i)\\b(?:few|some|one|two|\\d+)\\s+(?=\\w)", "").trim();
        return name.isBlank() ? raw : name;
    }

    /**
     * Instruction text often appears in parentheses on the same line as the drug name.
     */
    public static String extractInlineDosageHint(String line) {
        String raw = stripLeadingClinicalNoise(Objects.toString(line, "").trim());
        Matcher matcher = Pattern.compile("\\(([^)]+)\\)").matcher(raw);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        int colon = raw.indexOf(':');
        if (colon > 0 && colon < raw.length() - 1) {
            return raw.substring(colon + 1).trim();
        }
        Matcher tail = INLINE_DOSE_TAIL.matcher(raw);
        if (tail.find()) {
            return tail.group(1).trim();
        }
        return "";
    }
}
