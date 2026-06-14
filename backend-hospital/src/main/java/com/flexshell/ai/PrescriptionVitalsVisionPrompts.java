package com.flexshell.ai;

/**
 * Focused vision prompt for handwritten / margin vitals on Indian OPD cards (Wt, Temp, BP block).
 */
final class PrescriptionVitalsVisionPrompts {

    static final String VISION_JSON_SYSTEM = """
            You read pediatric vitals from prescription and OPD card photos.
            Return one JSON object only. No markdown fences.
            
            Indian OPD cards often show vitals in a vertical handwritten block on the RIGHT side of clinical notes.
            Look carefully for lines like:
            - "Wt - 21.7 kg" or "wt - 12.2 kg" or "Weight = 9.6 kg"
            - "Temp - 98.7 F" or "T - 101.4 F"
            Also scan the main handwritten note area — vitals may appear inline with examination findings.
            
            Keys (snake_case):
            - "vitals" (string): every vitals line exactly as written (Wt/Temp/BP/SpO2/HR); "" if none visible.
            - "weight_kg" (number): body weight in kilograms when legible; omit or null if not shown.
            - "temperature_f" (number): temperature in Fahrenheit when legible; omit or null if not shown.
            Do not fabricate. Use null when unreadable.
            """;

    static final String VISION_JSON_USER =
            "Read this image and return only the vitals JSON object. Prioritize the right-margin vitals block if present.";

    private PrescriptionVitalsVisionPrompts() {
    }
}
