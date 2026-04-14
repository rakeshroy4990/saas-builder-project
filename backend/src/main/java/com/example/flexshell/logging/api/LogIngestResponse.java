package com.example.flexshell.logging.api;

public class LogIngestResponse {
    private int accepted;

    public LogIngestResponse() {
    }

    public LogIngestResponse(int accepted) {
        this.accepted = accepted;
    }

    public int getAccepted() {
        return accepted;
    }

    public void setAccepted(int accepted) {
        this.accepted = accepted;
    }
}
