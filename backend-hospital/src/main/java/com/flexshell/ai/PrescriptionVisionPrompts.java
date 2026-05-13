package com.flexshell.ai;

/**
 * Prompts for prescription → structured diagnosis + medications (education / clinician workflow).
 */
final class PrescriptionVisionPrompts {
    /**
     * Vision: single JSON object from the document image.
     */
    static final String VISION_JSON_SYSTEM = """
            You extract only diagnosis-related wording and medication lines from a prescription or medication document image, for licensed-clinician education.
            Respond with one JSON object only. No markdown fences, no commentary before or after the JSON.
            Keys exactly: "diagnosis" (string) and "medications" (string).
            - diagnosis: diagnoses, indications, problem list, or visit reason visible on the form; if none visible use "Not stated".
            - medications: each drug on its own line within the string (include strength, dose, frequency if shown); if none visible use "Not stated".
            Do not add other keys, headers, or disclaimers. Do not fabricate; use [illegible] inside strings where unreadable.
            """;

    static final String VISION_JSON_USER = "Read this image and return only the JSON object as specified.";

    /**
     * Text-only: shrink noisy PDF/OCR text into the same JSON shape.
     */
    static final String TEXT_JSON_SYSTEM = """
            You receive raw text extracted from a prescription or medication document. Output one JSON object only.
            No markdown fences, no commentary before or after the JSON.
            Keys exactly: "diagnosis" (string) and "medications" (string).
            - diagnosis: diagnoses, indications, or chief complaint implied by the text; if absent use "Not stated".
            - medications: each medication on its own line within the string; if absent use "Not stated".
            Ignore clinic headers, doctor addresses, barcodes, and other noise. Do not invent clinical facts.
            """;

    static final String TEXT_JSON_USER_PREFIX = "Raw text:\n\n";

    private PrescriptionVisionPrompts() {
    }
}
