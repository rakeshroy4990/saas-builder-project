package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Builds {@code patient_prescriptions.search_text} from clinical fields only.
 * Embeddings must use this text — not full {@code extracted_data} — to avoid noise from
 * doctor names, dates, hospital letterhead, and admin footer text.
 */
public final class PatientPrescriptionSearchTextBuilder {

    private static final Pattern ADMIN_NOTE = Pattern.compile(
            "(?i).*(follow[- ]?up\\s+charg|applicable after|receipt\\s+no|registration\\s+no|"
                    + "emergency\\s*:|ambulance|pharmacy|appointment\\s*:|OPD\\s+Services|"
                    + "www\\.|https?://|\\+?\\d{10,}|call\\s+us|charges\\s+applicable).*"
    );

    private PatientPrescriptionSearchTextBuilder() {
    }

    public static String build(EducationPrescriptionTranscribeData data) {
        if (data == null) {
            return "";
        }
        List<String> segments = new ArrayList<>();

        String diagnosis = normalizeClinical(data.diagnosis());
        if (!diagnosis.isBlank()) {
            segments.add(diagnosis);
        }

        String medicinesBlock = joinClinicalList(data.medicines());
        if (!medicinesBlock.isBlank()) {
            segments.add(medicinesBlock);
        } else {
            String legacyMeds = normalizeClinical(data.medications());
            if (!legacyMeds.isBlank()) {
                segments.add(legacyMeds.replace('\n', ','));
            }
        }

        String dosageBlock = joinClinicalList(data.dosage());
        if (!dosageBlock.isBlank()) {
            segments.add(dosageBlock);
        }

        String clinicalNotes = clinicalNotesOnly(data.notes());
        if (!clinicalNotes.isBlank()) {
            segments.add(clinicalNotes);
        }

        return String.join(". ", segments).trim();
    }

    private static String joinClinicalList(List<String> items) {
        if (items == null || items.isEmpty()) {
            return "";
        }
        List<String> cleaned = new ArrayList<>();
        for (String item : items) {
            String t = normalizeClinical(item);
            if (!t.isBlank()) {
                cleaned.add(t);
            }
        }
        return cleaned.isEmpty() ? "" : String.join(", ", cleaned);
    }

    private static String clinicalNotesOnly(String notes) {
        String n = normalizeClinical(notes);
        if (n.isBlank()) {
            return "";
        }
        if (ADMIN_NOTE.matcher(n).matches()) {
            return "";
        }
        return n;
    }

    private static String normalizeClinical(String raw) {
        String t = Objects.toString(raw, "").trim();
        if (t.isBlank() || "not stated".equalsIgnoreCase(t) || "[illegible]".equalsIgnoreCase(t)) {
            return "";
        }
        return t;
    }
}
