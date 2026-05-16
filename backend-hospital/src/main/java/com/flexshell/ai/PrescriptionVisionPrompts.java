package com.flexshell.ai;

/**
 * Prompts for prescription / OPD card → structured JSON (education + patient upload storage).
 */
final class PrescriptionVisionPrompts {
    private static final String FULL_JSON_SCHEMA = """
            Respond with one JSON object only. No markdown fences, no commentary before or after the JSON.
            Extract every visible field from the prescription, OPD card, or clinic form. Use these keys exactly (snake_case).
            Use empty string "" for missing text fields and empty array [] for missing lists.
            
            REQUIRED — read the full printed header / demographics band before clinical notes. If visible on the document,
            you MUST populate: appointment_date, patient_gender, mobile_number, consultant, department (never leave these
            as "" when the label and value appear on the form).
            
            Patient & visit (from printed header / demographics):
            - "hospital_name" (string): clinic or hospital name from letterhead.
            - "document_type" (string): e.g. OPD CARD, Prescription, Rx.
            - "registration_number" (string): Reg. No. / UHID / MRN if shown.
            - "receipt_number" (string): receipt or bill number if shown.
            - "appointment_date" (string): appointment date/time as printed.
            - "patient_name" (string)
            - "patient_age" (string): age only if separable, e.g. "1Y 0M 17D"
            - "patient_gender" (string): e.g. MALE, FEMALE
            - "age_gender" (string): combined age/gender line if printed together
            - "department" (string): e.g. DERMATOLOGY
            - "consultant" (string): consulting doctor name as printed
            - "address" (string): patient address if shown
            - "mobile_number" (string): patient mobile / phone
            - "referred_by" (string): referrer if shown
            
            Clinical:
            - "diagnosis" (string): diagnosis, impression, or problem list from handwritten or printed notes.
            - "medicines" (array of strings): each drug or product with its instructions — include strength and how to use \
            (e.g. "NIZRAL 2% Shampoo: mix 3ml with 3ml water, apply, wait 3 min, wash; twice a week for 1 month").
            - "dosage" (array of strings): frequency/duration-only lines if listed separately from drug names; else [].
            - "advice" (array of strings): non-drug advice, application steps, or follow-up instructions as separate lines.
            - "doctor_name" (string): prescribing doctor (same as consultant if only one name visible).
            - "prescription_date" (string): date of prescription; use appointment_date if that is the only date.
            - "notes" (string): footer notes, follow-up policy, allergies, or other text not captured above.
            
            Do not fabricate. Use [illegible] inside strings where unreadable. Do not add other keys.
            """;

    static final String VISION_JSON_SYSTEM = """
            You extract structured fields from a prescription, OPD card, or medication document image for clinical records.
            """ + FULL_JSON_SCHEMA;

    static final String VISION_JSON_USER = "Read this image and return only the JSON object as specified.";

    static final String TEXT_JSON_SYSTEM = """
            You receive raw text extracted from a prescription or OPD card document.
            """ + FULL_JSON_SCHEMA + """
            Ignore barcodes and duplicate letterhead noise when possible.
            """;

    static final String TEXT_JSON_USER_PREFIX = "Raw text:\n\n";

    private PrescriptionVisionPrompts() {
    }
}
