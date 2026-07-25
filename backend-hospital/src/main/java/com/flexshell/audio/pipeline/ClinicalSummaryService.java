package com.flexshell.audio.pipeline;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiChatAdapter;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Stage 2 — clinical reasoning from Stage-1 structured JSON (SOAP, Dx suggestions, patient summary).
 */
@Service
public class ClinicalSummaryService {

    private static final String SYSTEM = """
            You are a clinical summary assistant for a licensed doctor. Use medical reasoning carefully.
            Input is structured extraction JSON from a consultation — not a diagnosis authority.
            Output ONLY JSON with PascalCase keys:
            Soap: { Subjective, Objective, Assessment, Plan },
            Assessment (string),
            DifferentialDiagnosis (array of strings),
            PossibleDiagnosis (array of strings),
            FollowUp (string),
            PatientSummary (string),
            ClinicalNotes (string).
            Mark suggestions as provisional. Do not invent vitals or exam findings not present in input.
            Objective may be empty if no exam data was captured.
            """;

    private final OpenAiChatAdapter chatAdapter;
    private final ObjectMapper objectMapper;

    public ClinicalSummaryService(OpenAiChatAdapter chatAdapter, ObjectMapper objectMapper) {
        this.chatAdapter = chatAdapter;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> generate(Map<String, Object> structuredJson) {
        if (structuredJson == null || structuredJson.isEmpty()) {
            throw new IllegalArgumentException("AUDIO_STRUCTURED_EMPTY");
        }
        try {
            String payload = objectMapper.writeValueAsString(structuredJson);
            String response = chatAdapter.completeClinicalJson(SYSTEM, "Structured consultation JSON:\n" + payload, 2200);
            return normalize(parse(response));
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("AUDIO_SUMMARY_FAILED", ex);
        }
    }

    private Map<String, Object> parse(String response) {
        String json = SpeakerDiarizationService.stripFences(response);
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception ex) {
            Map<String, Object> fallback = empty();
            fallback.put("ClinicalNotes", "Summary generation failed to parse; review transcript manually.");
            return fallback;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> normalize(Map<String, Object> raw) {
        Map<String, Object> out = empty();
        if (raw == null) {
            return out;
        }
        Object soapRaw = raw.containsKey("Soap") ? raw.get("Soap") : raw.get("soap");
        if (soapRaw instanceof Map<?, ?> soapMap) {
            Map<String, Object> soap = new LinkedHashMap<>();
            soap.put("Subjective", firstString(soapMap, "Subjective", "subjective"));
            soap.put("Objective", firstString(soapMap, "Objective", "objective"));
            soap.put("Assessment", firstString(soapMap, "Assessment", "assessment"));
            soap.put("Plan", firstString(soapMap, "Plan", "plan"));
            out.put("Soap", soap);
        }
        out.put("Assessment", firstString(raw, "Assessment", "assessment"));
        out.put("DifferentialDiagnosis", firstList(raw, "DifferentialDiagnosis", "differentialDiagnosis"));
        out.put("PossibleDiagnosis", firstList(raw, "PossibleDiagnosis", "possibleDiagnosis"));
        out.put("FollowUp", firstString(raw, "FollowUp", "followUp"));
        out.put("PatientSummary", firstString(raw, "PatientSummary", "patientSummary"));
        out.put("ClinicalNotes", firstString(raw, "ClinicalNotes", "clinicalNotes"));
        return out;
    }

    private static Map<String, Object> empty() {
        Map<String, Object> soap = new LinkedHashMap<>();
        soap.put("Subjective", "");
        soap.put("Objective", "");
        soap.put("Assessment", "");
        soap.put("Plan", "");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("Soap", soap);
        out.put("Assessment", "");
        out.put("DifferentialDiagnosis", List.of());
        out.put("PossibleDiagnosis", List.of());
        out.put("FollowUp", "");
        out.put("PatientSummary", "");
        out.put("ClinicalNotes", "");
        return out;
    }

    private static String firstString(Map<?, ?> map, String a, String b) {
        Object v = map.containsKey(a) ? map.get(a) : map.get(b);
        return v == null ? "" : Objects.toString(v, "");
    }

    private static List<?> firstList(Map<?, ?> map, String a, String b) {
        Object v = map.containsKey(a) ? map.get(a) : map.get(b);
        return v instanceof List<?> list ? list : List.of();
    }
}
