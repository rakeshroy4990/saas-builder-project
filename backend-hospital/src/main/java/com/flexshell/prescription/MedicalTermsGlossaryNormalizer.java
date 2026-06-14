package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Post-processes prescription transcription with {@link MedicalTermsGlossary}.
 */
public final class MedicalTermsGlossaryNormalizer {

    private MedicalTermsGlossaryNormalizer() {
    }

    public static EducationPrescriptionTranscribeData normalize(
            EducationPrescriptionTranscribeData data,
            MedicalTermsGlossary glossary
    ) {
        if (data == null || glossary == null || !glossary.isEnabled()) {
            return data;
        }
        String diagnosis = normalizeField(glossary, data.diagnosis());
        String medications = normalizeField(glossary, data.medications());
        List<String> medicines = normalizeList(glossary, data.medicines());
        List<String> dosage = normalizeList(glossary, data.dosage());
        List<String> advice = normalizeList(glossary, data.advice());
        List<String> investigations = normalizeList(glossary, data.investigations());
        String notes = normalizeField(glossary, data.notes());
        if (diagnosis.equals(data.diagnosis())
                && medications.equals(data.medications())
                && medicines.equals(data.medicines())
                && dosage.equals(data.dosage())
                && advice.equals(data.advice())
                && investigations.equals(data.investigations())
                && notes.equals(data.notes())) {
            return data;
        }
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
                diagnosis,
                medications,
                medicines,
                dosage,
                advice,
                investigations,
                data.doctorName(),
                data.prescriptionDate(),
                notes,
                data.weightKg(),
                data.temperatureF()
        );
    }

    private static String normalizeField(MedicalTermsGlossary glossary, String value) {
        String raw = Objects.toString(value, "").trim();
        if (raw.isBlank() || "Not stated".equalsIgnoreCase(raw)) {
            return raw;
        }
        return glossary.normalizeClinicalText(raw);
    }

    private static List<String> normalizeList(MedicalTermsGlossary glossary, List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        List<String> out = new ArrayList<>(values.size());
        for (String value : values) {
            out.add(normalizeField(glossary, value));
        }
        return List.copyOf(out);
    }
}
