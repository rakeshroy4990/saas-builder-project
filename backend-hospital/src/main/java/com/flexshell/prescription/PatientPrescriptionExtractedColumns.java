package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.Objects;

/**
 * Maps LLM extract → denormalized {@code patient_prescriptions} text columns.
 */
public final class PatientPrescriptionExtractedColumns {

    public record Values(String doctorName, String department, String patientName, String patientGender) {
    }

    private PatientPrescriptionExtractedColumns() {
    }

    public static Values from(EducationPrescriptionTranscribeData data) {
        if (data == null) {
            return new Values(null, null, null, null);
        }
        return new Values(
                blankToNull(data.resolvedDoctorName()),
                blankToNull(data.department()),
                blankToNull(data.patientName()),
                blankToNull(data.patientGender())
        );
    }

    private static String blankToNull(String raw) {
        String trimmed = Objects.toString(raw, "").trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
