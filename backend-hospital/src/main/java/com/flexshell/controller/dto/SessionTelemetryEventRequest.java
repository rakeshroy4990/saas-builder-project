package com.flexshell.controller.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public class SessionTelemetryEventRequest {
    @JsonProperty("EventName")
    @NotBlank
    private String eventName;

    @JsonProperty("Flow")
    @NotBlank
    private String flow;

    @JsonProperty("Status")
    private String status;

    @JsonProperty("ReasonCode")
    private String reasonCode;

    @JsonProperty("HttpStatus")
    private Integer httpStatus;

    @JsonProperty("TraceId")
    @NotBlank
    private String traceId;

    @JsonProperty("UserId")
    private String userId;

    /**
     * Client-minted UUID per successful login; when set, groups {@code session_summary} rows into a
     * dedicated {@code session_telemetry} document independent of {@link #traceId} reuse in the tab.
     */
    @JsonProperty("LoginSessionId")
    private String loginSessionId;

    @JsonProperty("SessionSummaryEntry")
    private SessionSummaryEntryDto sessionSummaryEntry;

    @JsonProperty("Os")
    private String os;

    @JsonProperty("DeviceId")
    private String deviceId;

    @JsonProperty("BrowserOrApp")
    private String browserOrApp;

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

    public String getLoginSessionId() {
        return loginSessionId;
    }

    public void setLoginSessionId(String loginSessionId) {
        this.loginSessionId = loginSessionId;
    }

    public SessionSummaryEntryDto getSessionSummaryEntry() {
        return sessionSummaryEntry;
    }

    public void setSessionSummaryEntry(SessionSummaryEntryDto sessionSummaryEntry) {
        this.sessionSummaryEntry = sessionSummaryEntry;
    }

    public String getOs() {
        return os;
    }

    public void setOs(String os) {
        this.os = os;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public String getBrowserOrApp() {
        return browserOrApp;
    }

    public void setBrowserOrApp(String browserOrApp) {
        this.browserOrApp = browserOrApp;
    }
}
