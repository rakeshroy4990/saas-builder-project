package com.example.flexshell.logging.api;

public class LogLevelResponse {
    private String level;

    public LogLevelResponse() {
    }

    public LogLevelResponse(String level) {
        this.level = level;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }
}
