package com.flexshell.audio.pipeline;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiChatAdapter;
import com.flexshell.prescription.ClinicTelemedicinePrescriptionSchema;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Builds a doctor-reviewable prescription from the full consultation context
 * (transcript + Stage-1 structured facts + Stage-2 summary).
 * Medicine rows match {@link ClinicTelemedicinePrescriptionSchema} so they can feed e-prescription.
 */
@Service
public class PrescriptionFromConversationService {

    private static final String SYSTEM = """
            You are a clinical documentation assistant for a licensed doctor.
            From the consultation transcript and structured notes, draft a standard outpatient prescription
            for doctor review. Do not invent medicines, doses, or diagnoses that are not supported by the input.
            If the doctor did not prescribe anything, leave Medicines empty and note that under ClinicalNotes.
            Prefer provisional wording for diagnosis when uncertain (e.g. "provisional: …").
            Output ONLY JSON with PascalCase keys:
            Complaint (string — chief complaint / presenting problem),
            History (string — relevant past + family + illness history),
            Diagnosis (string — working/provisional diagnosis if any),
            Medicines (array of objects with:
              Name, Strength, Dose, Frequency, Route, DurationDays, Instructions, ScheduleCategory),
            Investigations (array of strings),
            Advice (string — general advice; may join multiple points),
            FollowUpAdvice (string),
            Allergies (string),
            ClinicalNotes (string — short caveats for the doctor).
            Medicine fields align with clinic telemedicine e-prescription lines.
            """;

    private final OpenAiChatAdapter chatAdapter;
    private final ObjectMapper objectMapper;

    public PrescriptionFromConversationService(OpenAiChatAdapter chatAdapter, ObjectMapper objectMapper) {
        this.chatAdapter = chatAdapter;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> generate(
            String transcriptText,
            Map<String, Object> structuredJson,
            Map<String, Object> summaryJson
    ) {
        String transcript = Objects.toString(transcriptText, "").trim();
        if (transcript.isBlank()
                && (structuredJson == null || structuredJson.isEmpty())
                && (summaryJson == null || summaryJson.isEmpty())) {
            throw new IllegalArgumentException("AUDIO_TRANSCRIPT_EMPTY");
        }
        try {
            Map<String, Object> input = new LinkedHashMap<>();
            input.put("Transcript", transcript);
            input.put("Structured", structuredJson == null ? Map.of() : structuredJson);
            input.put("Summary", summaryJson == null ? Map.of() : summaryJson);
            String payload = objectMapper.writeValueAsString(input);
            String response = chatAdapter.completeClinicalJson(
                    SYSTEM,
                    "Consultation context JSON:\n" + payload,
                    2400
            );
            return normalize(parse(response), structuredJson, summaryJson);
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("AUDIO_PRESCRIPTION_FAILED", ex);
        }
    }

    private Map<String, Object> parse(String response) {
        String json = SpeakerDiarizationService.stripFences(response);
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception ex) {
            return empty();
        }
    }

    private Map<String, Object> normalize(
            Map<String, Object> raw,
            Map<String, Object> structuredJson,
            Map<String, Object> summaryJson
    ) {
        Map<String, Object> out = empty();
        if (raw == null) {
            return seedFromContext(out, structuredJson, summaryJson);
        }
        out.put("Complaint", firstString(raw, "Complaint", "complaint", "ChiefComplaint", "chiefComplaint"));
        out.put("History", firstString(raw, "History", "history"));
        out.put("Diagnosis", firstString(raw, "Diagnosis", "diagnosis"));
        out.put("Medicines", normalizeMedicines(raw.get("Medicines") != null ? raw.get("Medicines") : raw.get("medicines")));
        out.put("Investigations", stringList(raw.get("Investigations") != null ? raw.get("Investigations") : raw.get("investigations")));
        out.put("Advice", firstString(raw, "Advice", "advice", "GeneralAdvice", "generalAdvice"));
        out.put("FollowUpAdvice", firstString(raw, "FollowUpAdvice", "followUpAdvice", "FollowUp", "followUp"));
        out.put("Allergies", firstString(raw, "Allergies", "allergies"));
        out.put("ClinicalNotes", firstString(raw, "ClinicalNotes", "clinicalNotes"));
        return seedFromContext(out, structuredJson, summaryJson);
    }

    /** Fill blanks from Stage-1 / Stage-2 when the model omitted them. */
    private static Map<String, Object> seedFromContext(
            Map<String, Object> out,
            Map<String, Object> structuredJson,
            Map<String, Object> summaryJson
    ) {
        Map<String, Object> structured = structuredJson == null ? Map.of() : structuredJson;
        Map<String, Object> summary = summaryJson == null ? Map.of() : summaryJson;

        if (blank(out.get("Complaint"))) {
            out.put("Complaint", firstString(structured, "ChiefComplaint", "chiefComplaint"));
        }
        if (blank(out.get("History"))) {
            String past = firstString(structured, "PastHistory", "pastHistory");
            String family = firstString(structured, "FamilyHistory", "familyHistory");
            String combined = joinNonBlank("\n", past.isBlank() ? null : "Past: " + past,
                    family.isBlank() ? null : "Family: " + family);
            out.put("History", combined);
        }
        if (blank(out.get("Diagnosis"))) {
            Object dx = summary.get("PossibleDiagnosis");
            if (dx == null) {
                dx = summary.get("possibleDiagnosis");
            }
            if (dx instanceof List<?> list && !list.isEmpty()) {
                List<String> parts = new ArrayList<>();
                for (Object item : list) {
                    String s = Objects.toString(item, "").trim();
                    if (!s.isBlank()) {
                        parts.add(s);
                    }
                }
                if (!parts.isEmpty()) {
                    out.put("Diagnosis", "Provisional: " + String.join("; ", parts));
                }
            } else {
                out.put("Diagnosis", firstString(summary, "Assessment", "assessment"));
            }
        }
        if (blank(out.get("Advice")) && structured.get("DoctorAdvice") instanceof List<?> advice) {
            List<String> parts = new ArrayList<>();
            for (Object item : advice) {
                String s = Objects.toString(item, "").trim();
                if (!s.isBlank()) {
                    parts.add(s);
                }
            }
            out.put("Advice", String.join("\n", parts));
        }
        if (blank(out.get("FollowUpAdvice"))) {
            out.put("FollowUpAdvice", firstString(structured, "FollowUp", "followUp"));
            if (blank(out.get("FollowUpAdvice"))) {
                out.put("FollowUpAdvice", firstString(summary, "FollowUp", "followUp"));
            }
        }
        if (blank(out.get("Allergies")) && structured.get("AllergiesMentioned") instanceof List<?> allergies) {
            List<String> parts = new ArrayList<>();
            for (Object item : allergies) {
                String s = Objects.toString(item, "").trim();
                if (!s.isBlank()) {
                    parts.add(s);
                }
            }
            out.put("Allergies", String.join(", ", parts));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> normalizeMedicines(Object raw) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (!(raw instanceof List<?> list)) {
            return out;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> med = emptyMedicine();
                med.put("Name", firstString(map, "Name", "name"));
                med.put("Strength", firstString(map, "Strength", "strength"));
                med.put("Dose", firstString(map, "Dose", "dose"));
                med.put("Frequency", firstString(map, "Frequency", "frequency"));
                med.put("Route", firstString(map, "Route", "route"));
                med.put("DurationDays", firstString(map, "DurationDays", "durationDays"));
                med.put("Instructions", firstString(map, "Instructions", "instructions"));
                med.put("ScheduleCategory", firstString(map, "ScheduleCategory", "scheduleCategory"));
                if (!blank(med.get("Name"))) {
                    out.add(med);
                }
            } else if (item != null) {
                String line = Objects.toString(item, "").trim();
                if (!line.isBlank()) {
                    Map<String, Object> med = emptyMedicine();
                    med.put("Name", line);
                    out.add(med);
                }
            }
        }
        return out;
    }

    private static Map<String, Object> emptyMedicine() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("Name", "");
        m.put("Strength", "");
        m.put("Dose", "");
        m.put("Frequency", "");
        m.put("Route", "");
        m.put("DurationDays", "");
        m.put("Instructions", "");
        m.put("ScheduleCategory", "");
        return m;
    }

    public static Map<String, Object> empty() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("Complaint", "");
        out.put("History", "");
        out.put("Diagnosis", "");
        out.put("Medicines", List.of());
        out.put("Investigations", List.of());
        out.put("Advice", "");
        out.put("FollowUpAdvice", "");
        out.put("Allergies", "");
        out.put("ClinicalNotes", "");
        return out;
    }

    /**
     * Maps AI Conversation prescription medicines/advice into clinic e-prescription payload keys (camelCase).
     */
    public static Map<String, Object> toEprescriptionPatch(Map<String, Object> prescription) {
        Map<String, Object> patch = new LinkedHashMap<>();
        List<Map<String, Object>> meds = new ArrayList<>();
        Object rawMeds = prescription == null ? null : prescription.get("Medicines");
        if (rawMeds instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> map)) {
                    continue;
                }
                Map<String, Object> med = new LinkedHashMap<>();
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_NAME, firstString(map, "Name", "name"));
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_STRENGTH, firstString(map, "Strength", "strength"));
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_DOSE, firstString(map, "Dose", "dose"));
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_FREQUENCY, firstString(map, "Frequency", "frequency"));
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_ROUTE, firstString(map, "Route", "route"));
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_DURATION_DAYS, firstString(map, "DurationDays", "durationDays"));
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_INSTRUCTIONS, firstString(map, "Instructions", "instructions"));
                med.put(ClinicTelemedicinePrescriptionSchema.KEY_MED_SCHEDULE_CATEGORY, firstString(map, "ScheduleCategory", "scheduleCategory"));
                if (!blank(med.get(ClinicTelemedicinePrescriptionSchema.KEY_MED_NAME))) {
                    meds.add(med);
                }
            }
        }
        if (!meds.isEmpty()) {
            patch.put(ClinicTelemedicinePrescriptionSchema.KEY_MEDICINES, meds);
        }
        if (prescription != null) {
            String advice = firstString(prescription, "Advice", "advice");
            if (!advice.isBlank()) {
                patch.put(ClinicTelemedicinePrescriptionSchema.KEY_GENERAL_ADVICE, advice);
            }
            String followUp = firstString(prescription, "FollowUpAdvice", "followUpAdvice");
            if (!followUp.isBlank()) {
                patch.put(ClinicTelemedicinePrescriptionSchema.KEY_FOLLOW_UP_ADVICE, followUp);
            }
        }
        return patch;
    }

    private static List<String> stringList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            String s = Objects.toString(item, "").trim();
            if (!s.isBlank()) {
                out.add(s);
            }
        }
        return out;
    }

    private static String firstString(Map<?, ?> map, String... keys) {
        if (map == null) {
            return "";
        }
        for (String key : keys) {
            if (map.containsKey(key) && map.get(key) != null) {
                return Objects.toString(map.get(key), "").trim();
            }
        }
        return "";
    }

    private static boolean blank(Object v) {
        return v == null || Objects.toString(v, "").trim().isBlank();
    }

    private static String joinNonBlank(String sep, String... parts) {
        List<String> kept = new ArrayList<>();
        for (String p : parts) {
            if (p != null && !p.isBlank()) {
                kept.add(p.trim());
            }
        }
        return String.join(sep, kept);
    }
}
