package com.example.flexshell.logging.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class LogLevelChangeRequest {
    @NotBlank(message = "level is required")
    @Pattern(
            regexp = "DEBUG|INFO|WARN|ERROR",
            message = "level must be one of DEBUG, INFO, WARN, ERROR")
    private String level;

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }
}
