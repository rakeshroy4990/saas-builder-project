package com.flexshell.prescription;

import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;

import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fills missing OPD header fields from printable PDF/text (labels like "Appointment Date:", "Mobile No.").
 * Used when the vision/LLM model omits printed demographics but the text layer still contains them.
 */
public final class OpdPrintedFieldExtractor {

    private static final Pattern APPOINTMENT_DATE = Pattern.compile(
            "(?im)^\\s*appointment\\s*date\\s*[:\\-]\\s*(.+?)\\s*$");
    private static final Pattern MOBILE = Pattern.compile(
            "(?im)^\\s*mobile\\s*(?:no\\.?|number|#)?\\s*[:\\-]\\s*([+\\d][\\d\\s\\-]{8,18})\\s*$");
    private static final Pattern DEPARTMENT = Pattern.compile(
            "(?im)^\\s*department\\s*[:\\-]\\s*(.+?)\\s*$");
    private static final Pattern CONSULTANT = Pattern.compile(
            "(?im)^\\s*consultant\\s*[:\\-]\\s*(.+?)\\s*$");
    private static final Pattern AGE_GENDER_LINE = Pattern.compile(
            "(?im)^\\s*age\\s*/\\s*gender\\s*[:\\-]\\s*(.+?)\\s*$");
    private static final Pattern PATIENT_NAME = Pattern.compile(
            "(?im)^\\s*patient\\s*name\\s*[:\\-]\\s*(.+?)\\s*$");
    private static final Pattern REG_NO = Pattern.compile(
            "(?im)^\\s*(?:reg(?:istration)?\\.?\\s*no\\.?|uhid|mrn)\\s*[:\\-]\\s*(.+?)\\s*$",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern AGE_GENDER_SPLIT = Pattern.compile(
            "^(.+?)\\s*/\\s*(MALE|FEMALE|OTHER|BOY|GIRL|M|F)\\b",
            Pattern.CASE_INSENSITIVE);

    private OpdPrintedFieldExtractor() {
    }

    public static EducationPrescriptionTranscribeData enrich(
            EducationPrescriptionTranscribeData data,
            String rawDocumentText
    ) {
        if (data == null) {
            return null;
        }
        String text = Objects.toString(rawDocumentText, "");
        EducationPrescriptionTranscribeData withText = text.isBlank()
                ? data
                : mergeFromPlainText(data, text);
        return splitAgeGenderIfNeeded(withText);
    }

    private static EducationPrescriptionTranscribeData mergeFromPlainText(
            EducationPrescriptionTranscribeData data,
            String text
    ) {
        return new EducationPrescriptionTranscribeData(
                data.hospitalName(),
                data.documentType(),
                firstNonBlank(data.registrationNumber(), matchLine(REG_NO, text)),
                data.receiptNumber(),
                firstNonBlank(data.appointmentDate(), matchLine(APPOINTMENT_DATE, text)),
                firstNonBlank(data.patientName(), matchLine(PATIENT_NAME, text)),
                data.patientAge(),
                data.patientGender(),
                firstNonBlank(data.ageGender(), matchLine(AGE_GENDER_LINE, text)),
                firstNonBlank(data.department(), matchLine(DEPARTMENT, text)),
                firstNonBlank(data.consultant(), matchLine(CONSULTANT, text)),
                data.address(),
                firstNonBlank(data.mobileNumber(), normalizeMobile(matchLine(MOBILE, text))),
                data.referredBy(),
                data.diagnosis(),
                data.medications(),
                data.medicines(),
                data.dosage(),
                data.advice(),
                data.doctorName(),
                data.prescriptionDate(),
                data.notes()
        );
    }

    public static EducationPrescriptionTranscribeData splitAgeGenderIfNeeded(EducationPrescriptionTranscribeData data) {
        String ageGender = data.ageGender();
        if (ageGender.isBlank()) {
            return data;
        }
        String patientAge = data.patientAge();
        String patientGender = data.patientGender();
        if (!patientAge.isBlank() && !patientGender.isBlank()) {
            return data;
        }
        Matcher m = AGE_GENDER_SPLIT.matcher(ageGender.trim());
        if (!m.find()) {
            return data;
        }
        String age = patientAge.isBlank() ? m.group(1).trim() : patientAge;
        String gender = patientGender.isBlank() ? m.group(2).trim().toUpperCase() : patientGender;
        if ("M".equalsIgnoreCase(gender)) {
            gender = "MALE";
        } else if ("F".equalsIgnoreCase(gender)) {
            gender = "FEMALE";
        }
        return new EducationPrescriptionTranscribeData(
                data.hospitalName(),
                data.documentType(),
                data.registrationNumber(),
                data.receiptNumber(),
                data.appointmentDate(),
                data.patientName(),
                age,
                gender,
                ageGender,
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
                data.doctorName(),
                data.prescriptionDate(),
                data.notes()
        );
    }

    private static String matchLine(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        return m.find() ? m.group(1).trim() : "";
    }

    private static String normalizeMobile(String raw) {
        String digits = raw.replaceAll("[^\\d+]", "").trim();
        return digits.isBlank() ? raw.trim() : digits;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return "";
    }
}
