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
            3. Always stay on the same health topic established in the conversation.
               If the first user message is about stomach pain or digestion, all follow-up replies
               must stay in that context, even for vague questions like "what should I do?".
            4. Never shift to another condition (respiratory, cardiac, etc.) unless the user
               explicitly introduces new symptoms in that system.
            5. If a follow-up question is ambiguous, resolve it using the latest established topic
               from the conversation history.
            6. For any of the following, ALWAYS recommend seeing a doctor immediately:
               - Chest pain, difficulty breathing, stroke symptoms
               - High fever (>103°F / 39.4°C) in adults, any fever in infants
               - Severe abdominal pain, uncontrolled bleeding
               - Suicidal or self-harm language
            7. For moderate symptoms, suggest: rest, hydration, OTC remedies where appropriate.
            8. End every response with the line:
               "💡 This is general guidance only. If symptoms worsen or persist, please consult a qualified healthcare provider."
            9. Be warm, clear, and easy to understand. Avoid medical jargon.
            10. Keep the response practical and concise.
            11. Respond in this exact structure:
               1. Possible causes
               2. What you can do
               3. When to see a doctor
             12. TOPIC LOCK — critical: once a health topic is established in the conversation
                (e.g. stomach pain, skin rash, headache), you are LOCKED to that topic for all
                follow-up replies in the same session. Never mention unrelated conditions such as
                respiratory infections, flu, or viral illness unless the user explicitly says they
                have those symptoms. Violating this rule causes serious patient confusion.
            13. FALLBACK RESOLUTION — if a follow-up message has no explicit symptom (e.g.
                "what should I do?", "is this serious?", "when should I see a doctor?"), look at
                the last user message that contained a symptom and answer in that context.
                Never default to generic or respiratory answers for GI/digestive threads.
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
    public enum EscalationType {
        OVERDOSE_POISONING,
        CARDIAC_RESPIRATORY,
        MENTAL_HEALTH,
        SEVERE_BLEEDING,
        HIGH_FEVER
    }
    private static final Pattern NEXT_OPTIONS_BLOCK_PATTERN = Pattern.compile("(?is)\\n\\s*next options\\s*:.*$");

    public AiSafetyPolicy(@Value("${app.ai.system-prompt:}") String configuredSystemPrompt) {
        String prompt = String.valueOf(configuredSystemPrompt == null ? "" : configuredSystemPrompt).trim();
        this.effectiveSystemPrompt = prompt.isEmpty() ? SYSTEM_PROMPT : prompt;
    }

    public String systemPrompt() {
        return effectiveSystemPrompt;
    }

    public Optional<EscalationType> detectEscalationType(String input) {
        String text = input == null ? "" : input.toLowerCase();

        if (OVERDOSE_PATTERNS.matcher(text).find())         return Optional.of(EscalationType.OVERDOSE_POISONING);
        if (CARDIAC_PATTERNS.matcher(text).find())          return Optional.of(EscalationType.CARDIAC_RESPIRATORY);
        if (MENTAL_HEALTH_PATTERNS.matcher(text).find())    return Optional.of(EscalationType.MENTAL_HEALTH);
        if (BLEEDING_PATTERNS.matcher(text).find())         return Optional.of(EscalationType.SEVERE_BLEEDING);
        if (HIGH_FEVER_PATTERNS.matcher(text).find())       return Optional.of(EscalationType.HIGH_FEVER);

        return Optional.empty();
    }

    public String escalationReply(EscalationType type) {
        String specific = switch (type) {
        case OVERDOSE_POISONING ->
            "This may be a possible overdose or poisoning emergency. " +
            "Call your local emergency number immediately, or contact your poison " +
            "control center right away for urgent guidance.\n\n" +
            "Do not take more medicine. Keep the medicine strip/bottle nearby " +
            "to share the exact dose and time taken.";

        case CARDIAC_RESPIRATORY ->
            "These symptoms may indicate a serious cardiac or breathing emergency. " +
            "Call your local emergency number immediately — do not wait.\n\n" +
            "If chest pain is present: sit down, stay calm, and do not eat or drink anything. " +
            "Unlock your door if possible so emergency services can reach you.";

        case MENTAL_HEALTH ->
            "It sounds like you may be going through a very difficult time. " +
               "Please reach out to a crisis helpline or emergency services right away — " +
            "you do not have to face this alone.\n\n" +
            "In India: iCall — 9152987821 | Vandrevala Foundation — 1860-2662-345 (24x7)";

        case SEVERE_BLEEDING ->
            "Uncontrolled bleeding is a medical emergency. " +
            "Call your local emergency number immediately.\n\n" +
            "Apply firm, continuous pressure to the wound with a clean cloth. " +
            "Do not remove the cloth — add more on top if it soaks through.";

        case HIGH_FEVER ->
            "A fever this high requires immediate medical attention. " +
            "Go to the nearest emergency room or call emergency services now.\n\n" +
            "While waiting: remove heavy clothing, stay hydrated, " +
            "and use a cool (not cold) compress on the forehead.";
    };

    return specific + "\n\n" + NON_DOCTOR_LINE + "\n\n" + DISCLAIMER_LINE;
}

    public String enforceSafeResponse(String raw, String userMessage) {
        String body = normalizeWhitespace(raw);
        body = stripNextOptionsBlock(body);
        if (isRagFallbackMessage(body)) {
            body = "";
        }
        String normalizedUserMessage = normalizeWhitespace(userMessage);
        if (body.isBlank()) {
            body = fallbackStructuredResponse(normalizedUserMessage);
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

    private static String stripNextOptionsBlock(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        return NEXT_OPTIONS_BLOCK_PATTERN.matcher(body).replaceFirst("").trim();
    }

    private static String fallbackStructuredResponse() {
    // Pure static fallback — no raw AI text injected.
    // Called only when the model reply is blank, malformed, or unparseable.
    return "1. Possible causes\n"
            + "- Symptoms may come from irritation, infection, inflammation, "
            + "or food-related triggers depending on your history.\n"
            + "- A clinician can confirm the exact cause with examination "
            + "if symptoms continue.\n\n"
            + "2. What you can do\n"
            + "- Rest, stay hydrated, and monitor symptom pattern and severity.\n"
            + "- Use only age-appropriate OTC relief that is safe for your medical history.\n"
            + "- Note when symptoms started, what makes them better or worse, "
            + "and any associated symptoms like fever or nausea.\n\n"
            + "3. When to see a doctor\n"
            + "- See a doctor promptly if symptoms persist, worsen, "
            + "or new symptoms appear.\n"
            + "- Seek urgent care immediately for severe pain, breathing difficulty, "
            + "confusion, persistent high fever, dehydration, or bleeding.\n\n"
            + AI_NON_DOCTOR_LINE + "\n\n"
            + AI_DISCLAIMER_LINE;
}
}
