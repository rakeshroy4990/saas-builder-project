package com.flexshell.ai;

import java.util.Locale;
import java.util.Objects;

/**
 * Retries for transient LLM HTTP failures (rate limits, capacity, 5xx). No request bodies are logged here.
 */
public final class AiProviderHttpRetry {

    private AiProviderHttpRetry() {
    }

    public static boolean shouldRetryAfterHttpFailure(int httpStatus, String responseBody) {
        if (httpStatus >= 200 && httpStatus < 300) {
            return false;
        }
        if (httpStatus == 401 || httpStatus == 403) {
            return false;
        }
        if (httpStatus == 429 || httpStatus == 408) {
            return true;
        }
        if (httpStatus >= 500) {
            return true;
        }
        if (httpStatus == 400) {
            String blob = combinedLower(responseBody);
            return blob.contains("rate_limit")
                    || blob.contains("resource_exhausted")
                    || blob.contains("server_error")
                    || transientCapacityOrOverload(blob);
        }
        return false;
    }

    private static String combinedLower(String responseBody) {
        return Objects.toString(responseBody, "").toLowerCase(Locale.ROOT);
    }

    /** {@code responseBody} should already be lower-case. */
    static boolean transientCapacityOrOverload(String lowerCaseBlob) {
        if (lowerCaseBlob.isBlank()) {
            return false;
        }
        return lowerCaseBlob.contains("high demand")
                || lowerCaseBlob.contains("resource exhausted")
                || lowerCaseBlob.contains("overloaded")
                || lowerCaseBlob.contains("try again later")
                || lowerCaseBlob.contains("too many requests")
                || lowerCaseBlob.contains("temporarily unavailable")
                || lowerCaseBlob.contains("service unavailable");
    }

    /**
     * @param zeroBasedRetryIndex 0 after first failure, 1 after second, …
     */
    public static void sleepBeforeRetry(int zeroBasedRetryIndex) throws InterruptedException {
        long ms = 450L * (1L << Math.min(zeroBasedRetryIndex, 4));
        Thread.sleep(Math.min(ms, 5000L));
    }
}
