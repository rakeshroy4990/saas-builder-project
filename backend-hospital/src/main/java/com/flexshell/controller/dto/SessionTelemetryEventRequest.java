package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public class SessionTelemetryEventRequest {
    @JsonProperty("event_name")
    @NotBlank
    private String eventName;

    @JsonProperty("flow")
    @NotBlank
    private String flow;

    @JsonProperty("status")
    private String status;

    @JsonProperty("reason_code")
    private String reasonCode;

    @JsonProperty("http_status")
    private Integer httpStatus;

    @JsonProperty("trace_id")
    @NotBlank
    private String traceId;

    @JsonProperty("user_id")
    private String userId;

    public String getEventName() {
        return eventName;
    }

    public void setEventName(String eventName) {
        this.eventName = eventName;
    }

    public String getFlow() {
        return flow;
    }

    public void setFlow(String flow) {
        this.flow = flow;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public void setReasonCode(String reasonCode) {
        this.reasonCode = reasonCode;
    }

    public Integer getHttpStatus() {
        return httpStatus;
    }

    public void setHttpStatus(Integer httpStatus) {
        this.httpStatus = httpStatus;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
