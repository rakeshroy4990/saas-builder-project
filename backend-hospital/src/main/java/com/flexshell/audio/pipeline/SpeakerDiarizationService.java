package com.flexshell.audio.pipeline;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiChatAdapter;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Labels consultation turns as Doctor / Patient. Replaceable with acoustic diarization later.
 */
@Service
public class SpeakerDiarizationService {

    private static final String SYSTEM = """
            You label speakers in a medical consultation transcript.
            Output ONLY a JSON array. No markdown.
            Each element: {"Speaker":"Doctor"|"Patient","Text":"..."}.
            CRITICAL: Copy Text EXACTLY as given — keep Devanagari Hindi and Kannada scripts unchanged.
            Do NOT transliterate Hindi into Latin letters. Do NOT translate. Do NOT correct spelling.
            Do NOT drop words. Preserve English drug/lab names as written.
            Do NOT use Speaker 1 / Speaker 2.
            If unsure, prefer Doctor for clinical questions and Patient for symptom answers.
            """;

    private final OpenAiChatAdapter chatAdapter;
    private final ObjectMapper objectMapper;

    public SpeakerDiarizationService(OpenAiChatAdapter chatAdapter, ObjectMapper objectMapper) {
        this.chatAdapter = chatAdapter;
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> diarize(String rawTranscript, boolean swapSpeakers) {
        String raw = Objects.toString(rawTranscript, "").trim();
        if (raw.isBlank()) {
            return List.of();
        }
        String response = chatAdapter.completeClinicalJson(SYSTEM, "Transcript:\n" + raw, 2500);
        List<Map<String, Object>> turns = parseTurns(response);
        if (turns.isEmpty()) {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("Speaker", "Doctor");
            fallback.put("Text", raw);
            turns = List.of(fallback);
        }
        if (swapSpeakers) {
            return swap(turns);
        }
        return turns;
    }

    public List<Map<String, Object>> swap(List<Map<String, Object>> turns) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> turn : turns) {
            Map<String, Object> copy = new LinkedHashMap<>(turn);
            String speaker = Objects.toString(copy.get("Speaker"), "").trim();
            if ("Doctor".equalsIgnoreCase(speaker)) {
                copy.put("Speaker", "Patient");
            } else if ("Patient".equalsIgnoreCase(speaker)) {
                copy.put("Speaker", "Doctor");
            }
            out.add(copy);
        }
        return out;
    }

    private List<Map<String, Object>> parseTurns(String response) {
        String json = stripFences(response);
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root.isArray()) {
                return objectMapper.convertValue(root, new TypeReference<>() {});
            }
            if (root.isObject() && root.has("Turns")) {
                return objectMapper.convertValue(root.get("Turns"), new TypeReference<>() {});
            }
        } catch (Exception ignored) {
            // fall through
        }
        return List.of();
    }

    static String stripFences(String text) {
        String t = Objects.toString(text, "").trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl > 0) {
                t = t.substring(nl + 1);
            }
            int end = t.lastIndexOf("```");
            if (end >= 0) {
                t = t.substring(0, end);
            }
        }
        return t.trim();
    }

    public static String toPlainText(List<Map<String, Object>> turns) {
        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> turn : turns) {
            String speaker = Objects.toString(turn.get("Speaker"), "Doctor");
            String text = Objects.toString(turn.get("Text"), "").trim();
            if (text.isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append('\n');
            }
            sb.append(speaker).append(": ").append(text);
        }
        return sb.toString();
    }

    public static String normalizeSpeaker(String speaker) {
        String s = Objects.toString(speaker, "").trim().toLowerCase(Locale.ROOT);
        if (s.contains("patient")) {
            return "Patient";
        }
        return "Doctor";
    }
}
