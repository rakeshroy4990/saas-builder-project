package com.flexshell.ai;

/**
 * Thrown when a Smart AI request exceeds configured per-user limits (daily volume or input size).
 */
public class SmartAiQuotaExceededException extends RuntimeException {
    public static final String USER_LIMIT_MESSAGE =
            "Daily limit reached. Please try tomorrow. Subscribe to increase your limit";

    public enum Kind {
        DAILY,
        TOKEN
    }

    private final Kind kind;

    public SmartAiQuotaExceededException(Kind kind) {
        super(USER_LIMIT_MESSAGE);
        this.kind = kind;
    }

    public Kind kind() {
        return kind;
    }
}
