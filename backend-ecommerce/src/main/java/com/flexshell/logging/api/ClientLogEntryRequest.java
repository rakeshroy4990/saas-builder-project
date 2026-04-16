package com.flexshell.logging.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.HashMap;
import java.util.Map;

public class ClientLogEntryRequest {
    @NotBlank(message = "level is required")
    @Pattern(
            regexp = "DEBUG|INFO|WARN|ERROR",
            message = "level must be one of DEBUG, INFO, WARN, ERROR")
    private String level;

    @NotBlank(message = "message is required")
    private String message;

    @NotBlank(message = "timestamp is required")
    private String timestamp;

    private String traceId;

    @NotNull(message = "context must be provided")
    private Map<String, Object> context = new HashMap<>();

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public Map<String, Object> getContext() {
        return context;
    }

    public void setContext(Map<String, Object> context) {
        this.context = context;
    }
}
