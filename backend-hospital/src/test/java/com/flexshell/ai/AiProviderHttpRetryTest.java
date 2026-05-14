package com.flexshell.ai;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiProviderHttpRetryTest {

    @Test
    void retriesOn503() {
        assertTrue(AiProviderHttpRetry.shouldRetryAfterHttpFailure(503, "{}"));
    }

    @Test
    void noRetryOn401() {
        assertFalse(AiProviderHttpRetry.shouldRetryAfterHttpFailure(401, "unauthorized"));
    }

    @Test
    void retriesOn400WhenBodySuggestsOverload() {
        assertTrue(AiProviderHttpRetry.shouldRetryAfterHttpFailure(
                400,
                "{\"error\":{\"message\":\"Resource exhausted; try again later\"}}"));
    }

    @Test
    void transientKeywordsDetectsHighDemand() {
        assertTrue(AiProviderHttpRetry.transientCapacityOrOverload("model is experiencing high demand".toLowerCase()));
    }
}
