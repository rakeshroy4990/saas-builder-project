package com.flexshell.prescription;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses OCR-extracted {@code medicines[]} + {@code dosage[]} lines into structured medication rows
 * for prescription safety validation.
 */
public final class PrescriptionMedicationParser {

    private static final Pattern DOSE_MG = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*mg", Pattern.CASE_INSENSITIVE);
    private static final Pattern DOSE_ML = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*ml\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SYRUP_FORM = Pattern.compile(
            "(?i)\\b(?:syp\\.?|syrp\\.?|syr\\.?|syrup|susp\\.?|suspension)\\b"
    );
    private static final Pattern TRAILING_STRENGTH = Pattern.compile("(\\d{2,4})\\s*(?:mg\\s*/\\s*5\\s*ml)?\\s*$", Pattern.CASE_INSENSITIVE);

    private PrescriptionMedicationParser() {
    }

    public static List<Map<String, Object>> fromExtractedData(Map<String, Object> extractedData) {
        if (extractedData == null || extractedData.isEmpty()) {
            return List.of();
        }
        Object medicinesObj = extractedData.get("medicines");
        Object dosageObj = extractedData.get("dosage");
        List<String> medicines = toStringList(medicinesObj);
        List<String> dosages = toStringList(dosageObj);
        if (medicines.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < medicines.size(); i++) {
            String rawLine = medicines.get(i);
            if (rawLine == null || rawLine.isBlank()) {
                continue;
            }
            String dosageLine = i < dosages.size() ? dosages.get(i) : "";
            if (PrescriptionClinicalLineClassifier.looksLikeInvestigation(rawLine, dosageLine)) {
                continue;
            }
            String inlineDosage = PrescriptionClinicalLineClassifier.extractInlineDosageHint(rawLine);
            String combinedDosage = dosageLine;
            if (!inlineDosage.isBlank()) {
                combinedDosage = combinedDosage.isBlank() ? inlineDosage : combinedDosage + " " + inlineDosage;
            }
            String lookupName = PrescriptionClinicalLineClassifier.normalizeDrugNameForLookup(rawLine);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", lookupName.isBlank() ? rawLine.trim() : lookupName);
            Double doseMg = parseDoseMg(
                    lookupName.isBlank() ? rawLine.trim() : lookupName,
                    rawLine,
                    combinedDosage
            );
            if (doseMg != null) {
                row.put("dose_mg", doseMg);
            }
            Integer frequency = parseFrequency(combinedDosage);
            if (frequency == null) {
                frequency = parseFrequency(rawLine);
            }
            if (frequency != null) {
                row.put("frequency_per_day", frequency);
            }
            row.put("route", parseRoute(rawLine, combinedDosage));
            out.add(row);
        }
        return out;
    }

    public static List<Map<String, Object>> fromStructuredMedicines(List<Map<String, Object>> medicines) {
        if (medicines == null || medicines.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> med : medicines) {
            if (med == null || med.isEmpty()) {
                continue;
            }
            String name = firstNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_NAME, "name", "Name");
            if (name.isBlank()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", name);
            String doseText = firstNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_DOSE, "dose", "Dose");
            String strength = firstNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_STRENGTH, "strength", "Strength");
            Double doseMg = parseDoseMg(strength, doseText);
            if (doseMg != null) {
                row.put("dose_mg", doseMg);
            }
            String frequency = firstNonBlank(
                    med,
                    ClinicTelemedicinePrescriptionSchema.KEY_MED_FREQUENCY,
                    "frequency",
                    "Frequency"
            );
            Integer freqPerDay = parseFrequency(frequency);
            if (freqPerDay != null) {
                row.put("frequency_per_day", freqPerDay);
            }
            String route = firstNonBlank(med, ClinicTelemedicinePrescriptionSchema.KEY_MED_ROUTE, "route", "Route");
            row.put("route", route.isBlank() ? "oral" : route.toLowerCase(Locale.ROOT));
            out.add(row);
        }
        return out;
    }

    private static List<String> toStringList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            if (item != null) {
                String s = item.toString().trim();
                if (!s.isBlank()) {
                    out.add(s);
                }
            }
        }
        return out;
    }

    private static String firstNonBlank(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val != null) {
                String s = val.toString().trim();
                if (!s.isBlank()) {
                    return s;
                }
            }
        }
        return "";
    }

    static Double parseDoseMg(String... parts) {
        String productName = parts.length > 0 ? objectsToString(parts[0]) : "";
        int paren = productName.indexOf('(');
        if (paren > 0) {
            productName = productName.substring(0, paren).trim();
        }
        StringBuilder dosageText = new StringBuilder();
        for (int i = 1; i < parts.length; i++) {
            if (parts[i] != null && !parts[i].isBlank()) {
                if (dosageText.length() > 0) {
                    dosageText.append(' ');
                }
                dosageText.append(parts[i].trim());
            }
        }
        if (parts.length > 0 && parts[0] != null && parts[0].contains("(")) {
            String inline = PrescriptionClinicalLineClassifier.extractInlineDosageHint(parts[0]);
            if (!inline.isBlank()) {
                if (dosageText.length() > 0) {
                    dosageText.append(' ');
                }
                dosageText.append(inline);
            }
        }
        String dosage = dosageText.toString();

        Matcher mlMatcher = DOSE_ML.matcher(dosage);
        boolean syrup = looksLikeSyrup(productName);
        if (!syrup) {
            for (String part : parts) {
                if (part != null && looksLikeSyrup(part)) {
                    syrup = true;
                    break;
                }
            }
        }
        if (mlMatcher.find() && syrup) {
            Integer strengthPer5Ml = parseSyrupStrengthMgPer5Ml(productName);
            if (strengthPer5Ml == null) {
                for (String part : parts) {
                    if (part != null) {
                        strengthPer5Ml = parseSyrupStrengthMgPer5Ml(part);
                        if (strengthPer5Ml != null) {
                            break;
                        }
                    }
                }
            }
            if (strengthPer5Ml != null) {
                double ml = Double.parseDouble(mlMatcher.group(1));
                return ml * (strengthPer5Ml / 5.0);
            }
        }

        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            Matcher matcher = DOSE_MG.matcher(part);
            if (matcher.find()) {
                return Double.parseDouble(matcher.group(1));
            }
        }

        if (!productName.isBlank() && !looksLikeSyrup(productName)) {
            Matcher tabletStrength = TRAILING_STRENGTH.matcher(productName.trim());
            if (tabletStrength.find()) {
                return Double.parseDouble(tabletStrength.group(1));
            }
        }
        return null;
    }

    static boolean looksLikeSyrup(String text) {
        return text != null && SYRUP_FORM.matcher(text).find();
    }

    static Integer parseSyrupStrengthMgPer5Ml(String productName) {
        if (productName == null || productName.isBlank()) {
            return null;
        }
        Matcher trailing = TRAILING_STRENGTH.matcher(productName.trim());
        if (trailing.find()) {
            return Integer.parseInt(trailing.group(1));
        }
        return null;
    }

    private static String objectsToString(String value) {
        return value == null ? "" : value;
    }

    static Integer parseFrequency(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.contains("od") || lower.contains("once daily") || lower.contains("once a day")) {
            return 1;
        }
        if (lower.contains("bd") || lower.contains("bid") || lower.contains("twice")) {
            return 2;
        }
        if (lower.contains("tds") || lower.contains("tid") || lower.contains("thrice")) {
            return 3;
        }
        if (lower.contains("qid") || lower.contains("q.i.d") || lower.contains("four times")) {
            return 4;
        }
        Matcher match = Pattern.compile("(\\d+)\\s*(?:x|times?)\\s*(?:per\\s*)?day").matcher(lower);
        if (match.find()) {
            return Integer.parseInt(match.group(1));
        }
        return null;
    }

    static String parseRoute(String name, String dosageLine) {
        String combined = (name + " " + dosageLine).toLowerCase(Locale.ROOT);
        if (combined.contains("inhal") || combined.contains("nebul")) {
            return "inhaled";
        }
        if (combined.contains(" topical") || combined.contains("ointment") || combined.contains("cream")) {
            return "topical";
        }
        if (combined.contains(" iv") || combined.contains("intravenous")) {
            return "iv";
        }
        if (combined.contains(" im") || combined.contains("intramuscular")
                || combined.contains(" inj") || combined.startsWith("inj")
                || combined.contains("injection")) {
            return "im";
        }
        return "oral";
    }
}
