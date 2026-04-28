package com.flexshell.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

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
            "infant fever", "high fever", "fever 103", "39.4",
            "overdose", "toxic dose", "toxicity", "poison", "poisoning",
            "drug overdose", "medication overdose", "pill overdose",
            "accidental ingestion", "took too much", "too many tablets",
            "azithromycin overdose", "azithromycin toxicity"
    );
    private static final Pattern NEXT_OPTIONS_BLOCK_PATTERN = Pattern.compile("(?is)\\n\\s*next options\\s*:.*$");

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
        return "This may be a possible overdose or poisoning emergency. Call your local emergency number immediately, or contact your poison control center right away for urgent guidance.\n\n"
                + "If this happened recently, do not take more medicine, and keep the medicine strip/bottle nearby to share exact dose and time taken.\n\n"
                + NON_DOCTOR_LINE + "\n\n"
                + DISCLAIMER_LINE;
    }

    public String enforceSafeResponse(String raw) {
        String body = normalizeWhitespace(raw);
        body = stripNextOptionsBlock(body);
        if (isRagFallbackMessage(body)) {
            if (!body.toLowerCase(Locale.ROOT).contains("not a doctor")) {
                body = body + "\n\n" + NON_DOCTOR_LINE;
            }
            if (!body.contains(DISCLAIMER_LINE)) {
                body = body + "\n\n" + DISCLAIMER_LINE;
            }
            return body.trim();
        }
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

    private static boolean isRagFallbackMessage(String body) {
        String normalized = normalize(body);
        return normalized.equals("not available")
                || normalized.equals("i don't have enough information to answer this.")
                || normalized.equals("i dont have enough information to answer this.")
                || normalized.equals("not enough information in knowledge base.")
                || normalized.startsWith("not enough information in knowledge base");
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

    private static String stripNextOptionsBlock(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        return NEXT_OPTIONS_BLOCK_PATTERN.matcher(body).replaceFirst("").trim();
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
                + "- Seek urgent care immediately for breathing difficulty, chest pain, confusion, persistent high fever, or dehydration signs.\n\n"
                + "Next options:\n"
                + "- Tell me your other symptoms so I can refine guidance.\n"
                + "- Do you want likely tests to discuss with your doctor?\n"
                + "- Show warning signs that need urgent care now.";
    }
}
