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
            - "diagnosis" (string): diagnosis, impression, problem list, symptoms, and examination findings from handwritten or printed notes.
              MUST include any visible vitals shorthand on the page (e.g. "Wt - 21.7 kg", "wt - 12.2 kg", "Temp - 98.7 F", "T - 101.4 F")
              when they appear anywhere on the form — especially the vertical vitals block on the RIGHT margin of Indian OPD cards.
              Use standard medical abbreviations exactly as written when legible (e.g. WALRI not WALFI or WALPH; LRTI/URTI not LRT1/URT1).
              Short uppercase tokens are often abbreviations — do not confuse R with F, P, or H; I with 1; or O with 0.
              Phrases like "Full WALRI chest" refer to wheezing on chest exam — transcribe WALRI with an R, not P or F.
            - "medicines" (array of strings): ONLY dispensed drugs and formulations — include syrups (Syp./Syr./Syrp.), tablets (Tab.), \
            capsules (Cap.), suspensions, drops, injections (Inj./Inj), vaccines given in clinic, ORS/rehydration sachets, etc. \
            Preserve numbered list prefixes in the text (e.g. "1) Inj Hapibev (Inactivated HepB)", "2) Inj Influvac Tetra", \
            "-> Syrp Calpol 250 3ml SOS if T > 99.5"). Each entry is one drug with strength and how to use. \
            NEVER put lab tests, cultures, swabs, imaging, or investigations here.
            - "investigations" (array of strings): lab tests, cultures, swabs, imaging, and diagnostic orders ONLY \
            (e.g. "Throat swab QS", "Stool R/E & culture", "CBC", "CBIL/LP/ESR", "USG abdomen"). \
            Do NOT put syrups (Syp./Syrp.), injections (Inj.), tablets, or other medicines in this list.
            - "dosage" (array of strings): frequency/duration-only lines if listed separately from drug names \
            (e.g. "if T > 99.5" on the line below an SOS syrup); else [].
            - "advice" (array of strings): non-drug advice, diet, rest, follow-up visit timing, or application steps.
            - "doctor_name" (string): prescribing doctor (same as consultant if only one name visible).
            - "prescription_date" (string): date of prescription; use appointment_date if that is the only date.
            - "notes" (string): footer notes, follow-up policy, allergies, or other text not captured above.
            
            - "vitals" (string): weight and temperature lines exactly as written (e.g. "wt - 12.2 kg", "T - 101.4 F"); also duplicate these lines inside "diagnosis" when present.
            - "examination" (string): on-examination / physical exam shorthand (O/E …); include wt/T here if written in the exam block.
            - "weight_kg" (number): numeric body weight in kilograms when visible (e.g. 12.2 for "wt - 12.2 kg"); use null or omit when not shown.
            - "temperature_f" (number): numeric temperature in Fahrenheit when visible (e.g. 101.4 for "T - 101.4 F"); use null or omit when not shown.
            Do not fabricate. Use [illegible] inside strings where unreadable.
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
