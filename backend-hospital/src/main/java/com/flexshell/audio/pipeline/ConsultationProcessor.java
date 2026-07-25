package com.flexshell.audio.pipeline;

import java.util.Map;

/**
 * Extensibility hook: future ICD-10, Rx, labs, billing, etc. consume Stage-1 structured JSON.
 */
public interface ConsultationProcessor {

    String id();

    /** Run after Stage 1; must not mutate core pipeline state unexpectedly. */
    default void afterStructuredAnalysis(Map<String, Object> structuredJson, Map<String, Object> context) {
        // no-op
    }

    default void afterClinicalSummary(Map<String, Object> summaryJson, Map<String, Object> context) {
        // no-op
    }
}
