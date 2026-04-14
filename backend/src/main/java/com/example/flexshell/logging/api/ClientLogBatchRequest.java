package com.example.flexshell.logging.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;

public class ClientLogBatchRequest {
    @NotBlank(message = "traceId is required")
    private String traceId;

    @NotNull(message = "entries must be provided")
    @Valid
    private List<ClientLogEntryRequest> entries = new ArrayList<>();

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public List<ClientLogEntryRequest> getEntries() {
        return entries;
    }

    public void setEntries(List<ClientLogEntryRequest> entries) {
        this.entries = entries;
    }
}
