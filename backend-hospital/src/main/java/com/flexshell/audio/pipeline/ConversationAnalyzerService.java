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
 * Stage 1 — extract structured consultation facts. NEVER diagnoses.
 */
@Service
public class ConversationAnalyzerService {

    private static final String SYSTEM = """
            You are a clinical conversation analyzer. Extract facts ONLY. NEVER diagnose.
            Output ONLY JSON with keys (PascalCase):
            ChiefComplaint (string),
            Duration (string),
            Symptoms (array of strings),
            NegativeSymptoms (array of strings),
            MedicationsMentioned (array of strings),
            AllergiesMentioned (array of strings),
            FamilyHistory (string),
            PastHistory (string),
            FollowUp (string),
            DoctorAdvice (array of strings),
            QuestionsAsked (array of strings),
            Language (string: English|Hindi|Kannada|Mixed).
            Preserve multilingual wording from the transcript where relevant.
            """;

    private final OpenAiChatAdapter chatAdapter;
    private final ObjectMapper objectMapper;

    public ConversationAnalyzerService(OpenAiChatAdapter chatAdapter, ObjectMapper objectMapper) {
        this.chatAdapter = chatAdapter;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> analyze(String diarizedTranscript) {
        String raw = Objects.toString(diarizedTranscript, "").trim();
        if (raw.isBlank()) {
            throw new IllegalArgumentException("AUDIO_TRANSCRIPT_EMPTY");
        }
        String response = chatAdapter.completeClinicalJson(SYSTEM, "Diarized transcript:\n" + raw, 1800);
        return parseObject(response);
    }

    private Map<String, Object> parseObject(String response) {
        String json = SpeakerDiarizationService.stripFences(response);
        try {
            Map<String, Object> map = objectMapper.readValue(json, new TypeReference<>() {});
            return ensureKeys(map);
        } catch (Exception ex) {
            Map<String, Object> fallback = emptyStructure();
            fallback.put("ChiefComplaint", "");
            fallback.put("ParseWarning", "Analyzer returned non-JSON; doctor should review transcript.");
            return fallback;
        }
    }

    private static Map<String, Object> emptyStructure() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ChiefComplaint", "");
        m.put("Duration", "");
        m.put("Symptoms", List.of());
        m.put("NegativeSymptoms", List.of());
        m.put("MedicationsMentioned", List.of());
        m.put("AllergiesMentioned", List.of());
        m.put("FamilyHistory", "");
        m.put("PastHistory", "");
        m.put("FollowUp", "");
        m.put("DoctorAdvice", List.of());
        m.put("QuestionsAsked", List.of());
        m.put("Language", "Mixed");
        return m;
    }

    private static Map<String, Object> ensureKeys(Map<String, Object> map) {
        Map<String, Object> out = emptyStructure();
        if (map == null) {
            return out;
        }
        // Accept camelCase from model and normalize to PascalCase wire keys.
        putString(out, map, "ChiefComplaint", "chiefComplaint");
        putString(out, map, "Duration", "duration");
        putList(out, map, "Symptoms", "symptoms");
        putList(out, map, "NegativeSymptoms", "negativeSymptoms");
        putList(out, map, "MedicationsMentioned", "medicationsMentioned");
        putList(out, map, "AllergiesMentioned", "allergiesMentioned");
        putString(out, map, "FamilyHistory", "familyHistory");
        putString(out, map, "PastHistory", "pastHistory");
        putString(out, map, "FollowUp", "followUp");
        putList(out, map, "DoctorAdvice", "doctorAdvice");
        putList(out, map, "QuestionsAsked", "questionsAsked");
        putString(out, map, "Language", "language");
        return out;
    }

    private static void putString(Map<String, Object> out, Map<String, Object> src, String pascal, String camel) {
        Object v = src.containsKey(pascal) ? src.get(pascal) : src.get(camel);
        if (v != null) {
            out.put(pascal, Objects.toString(v, ""));
        }
    }

    @SuppressWarnings("unchecked")
    private static void putList(Map<String, Object> out, Map<String, Object> src, String pascal, String camel) {
        Object v = src.containsKey(pascal) ? src.get(pascal) : src.get(camel);
        if (v instanceof List<?> list) {
            out.put(pascal, list);
        }
    }
}
