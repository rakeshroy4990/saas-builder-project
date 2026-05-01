package com.flexshell.telemetry;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "session_telemetry")
public class SessionTelemetryEntity {
    @Id
    private String id;

    @Field("SessionKey")
    private String sessionKey;

    @Field("UserId")
    private String userId;

    @Field("TraceId")
    private String traceId;

    @Field("StartedAt")
    private Instant startedAt;

    @Field("UpdatedAt")
    private Instant updatedAt;

    @Field("TotalEvents")
    private int totalEvents;

    @Field("EventCounts")
    private Map<String, Integer> eventCounts = new HashMap<>();

    @Field("FlowCounts")
    private Map<String, Integer> flowCounts = new HashMap<>();

    @Field("LastEventName")
    private String lastEventName;

    @Field("LastFlow")
    private String lastFlow;

    @Field("LastStatus")
    private String lastStatus;

    @Field("LastReasonCode")
    private String lastReasonCode;

    @Field("LastHttpStatus")
    private Integer lastHttpStatus;

    /**
     * Ordered log of UI/API actions for the authenticated session (same {@link #traceId} as the browser tab).
     */
    @Field("SessionSummary")
    private List<SessionSummaryEntryDocument> sessionSummary = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getSessionKey() {
        return sessionKey;
    }

    public void setSessionKey(String sessionKey) {
        this.sessionKey = sessionKey;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public int getTotalEvents() {
        return totalEvents;
    }

    public void setTotalEvents(int totalEvents) {
        this.totalEvents = totalEvents;
    }

    public Map<String, Integer> getEventCounts() {
        return eventCounts;
    }

    public void setEventCounts(Map<String, Integer> eventCounts) {
        this.eventCounts = eventCounts;
    }

    public Map<String, Integer> getFlowCounts() {
        return flowCounts;
    }

    public void setFlowCounts(Map<String, Integer> flowCounts) {
        this.flowCounts = flowCounts;
    }

    public String getLastEventName() {
        return lastEventName;
    }

    public void setLastEventName(String lastEventName) {
        this.lastEventName = lastEventName;
    }

    public String getLastFlow() {
        return lastFlow;
    }

    public void setLastFlow(String lastFlow) {
        this.lastFlow = lastFlow;
    }

    public String getLastStatus() {
        return lastStatus;
    }

    public void setLastStatus(String lastStatus) {
        this.lastStatus = lastStatus;
    }

    public String getLastReasonCode() {
        return lastReasonCode;
    }

    public void setLastReasonCode(String lastReasonCode) {
        this.lastReasonCode = lastReasonCode;
    }

    public Integer getLastHttpStatus() {
        return lastHttpStatus;
    }

    public void setLastHttpStatus(Integer lastHttpStatus) {
        this.lastHttpStatus = lastHttpStatus;
    }

    public List<SessionSummaryEntryDocument> getSessionSummary() {
        return sessionSummary;
    }

    public void setSessionSummary(List<SessionSummaryEntryDocument> sessionSummary) {
        this.sessionSummary = sessionSummary;
    }
}
