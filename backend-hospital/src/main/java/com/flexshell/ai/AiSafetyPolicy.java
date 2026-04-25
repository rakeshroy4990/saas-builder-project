package com.flexshell.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

@Component
public class AiSafetyPolicy {
    public static final String DISCLAIMER_LINE =
            "💡 This is general guidance only. If symptoms worsen or persist, please consult a qualified healthcare provider.";
    public static final String NON_DOCTOR_LINE = "I am not a doctor and this is not medical advice.";

    public static final String SYSTEM_PROMPT = """
            You are MediCheck, a compassionate AI triage assistant.
                        
            RULES — follow all strictly:
            1. Provide GENERAL health guidance only — never a diagnosis.
            2. Always clarify: "I am not a doctor and this is not medical advice."
            3. For any of the following, ALWAYS recommend seeing a doctor immediately:
               - Chest pain, difficulty breathing, stroke symptoms
               - High fever (>103°F / 39.4°C) in adults, any fever in infants
               - Severe abdominal pain, uncontrolled bleeding
               - Suicidal or self-harm language
            4. For moderate symptoms, suggest: rest, hydration, OTC remedies where appropriate.
            5. End every response with the line:
               "💡 This is general guidance only. If symptoms worsen or persist, please consult a qualified healthcare provider."
            6. Be warm, clear, and easy to understand. Avoid medical jargon.
            7. Keep the response practical and concise.
            8. Respond in this exact structure:
               1. Possible causes
               2. What you can do
               3. When to see a doctor
            """;
    private final String effectiveSystemPrompt;

    private static final Set<String> CRITICAL_KEYWORDS = Set.of(
            "chest pain", "difficulty breathing", "shortness of breath", "stroke",
            "slurred speech", "face drooping", "uncontrolled bleeding",
            "severe abdominal pain", "suicidal", "suicide", "self-harm", "self harm",
            "infant fever", "high fever", "fever 103", "39.4"
    );

    public AiSafetyPolicy(@Value("${app.ai.system-prompt:}") String configuredSystemPrompt) {
        String prompt = String.valueOf(configuredSystemPrompt == null ? "" : configuredSystemPrompt).trim();
        this.effectiveSystemPrompt = prompt.isEmpty() ? SYSTEM_PROMPT : prompt;
    }

    public String systemPrompt() {
        return effectiveSystemPrompt;
    }

    public boolean requiresEscalation(String text) {
        String normalized = normalize(text);
        if (normalized.isBlank()) {
            return false;
        }
        return CRITICAL_KEYWORDS.stream().anyMatch(normalized::contains);
    }

    public String escalationReply() {
        return "Your symptoms may need urgent medical attention. Please contact emergency services or visit the nearest emergency department immediately.\n\n"
                + NON_DOCTOR_LINE + "\n\n"
                + DISCLAIMER_LINE;
    }

    public String enforceSafeResponse(String raw) {
        String body = normalizeWhitespace(raw);
        if (body.isBlank()) {
            body = fallbackStructuredResponse("");
        } else if (!hasStructuredSections(body)) {
            body = fallbackStructuredResponse(body);
        }
        if (!body.toLowerCase(Locale.ROOT).contains("not a doctor")) {
            body = body + "\n\n" + NON_DOCTOR_LINE;
        }
        if (!body.contains(DISCLAIMER_LINE)) {
            body = body + "\n\n" + DISCLAIMER_LINE;
        }
        return body.trim();
    }

    private static String normalize(String value) {
        return String.valueOf(value == null ? "" : value).toLowerCase(Locale.ROOT).trim();
    }

    private static String normalizeWhitespace(String value) {
        return String.valueOf(value == null ? "" : value).replace("\r\n", "\n").trim();
    }

    private static boolean hasStructuredSections(String body) {
        String normalized = body.toLowerCase(Locale.ROOT);
        return normalized.contains("1. possible causes")
                && normalized.contains("2. what you can do")
                && normalized.contains("3. when to see a doctor");
    }

    private static String fallbackStructuredResponse(String rawModelText) {
        String hint = normalizeWhitespace(rawModelText);
        if (hint.isBlank()) {
            hint = "Symptoms like fever and cough are often related to mild viral respiratory infections, but only a licensed clinician can evaluate your exact condition.";
        }
        return "1. Possible causes\n"
                + "- Common viral upper respiratory infections can cause these symptoms.\n"
                + "- Seasonal flu or throat/chest irritation can also present similarly.\n\n"
                + "2. What you can do\n"
                + "- Rest well, stay hydrated, and monitor your temperature.\n"
                + "- You may use simple OTC symptom relief if appropriate for your age and history.\n"
                + "- Additional guidance: " + hint + "\n\n"
                + "3. When to see a doctor\n"
                + "- See a doctor promptly if symptoms persist beyond 2-3 days, worsen, or new symptoms appear.\n"
                + "- Seek urgent care immediately for breathing difficulty, chest pain, confusion, persistent high fever, or dehydration signs.";
    }
}
