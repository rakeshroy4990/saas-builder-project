package com.flexshell.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiSafetyPolicyTest {
    private final AiSafetyPolicy policy = new AiSafetyPolicy("");

    @Test
    void detectsEmergencyKeywords() {
        assertTrue(policy.requiresEscalation("I have chest pain and difficulty breathing"));
    }

    @Test
    void appendsRequiredDisclaimerWhenMissing() {
        String safe = policy.enforceSafeResponse("Try rest and hydration.", "What should I do?");
        assertTrue(safe.contains("not a doctor"));
        assertTrue(safe.contains(AiSafetyPolicy.DISCLAIMER_LINE));
    }

    @Test
    void ignoresNonEmergencyQuestion() {
        assertFalse(policy.requiresEscalation("Can I take paracetamol for cold?"));
    }
}
