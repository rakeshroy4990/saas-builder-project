package com.flexshell.persistence.postgres.model;

import com.flexshell.telemetry.SessionSummaryEntryDocument;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "session_telemetry")
public class SessionTelemetryJpaEntity {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "external_id", nullable = false)
    private UUID externalId;

    @Column(name = "session_key")
    private String sessionKey;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "trace_id")
    private String traceId;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "total_events", nullable = false)
    private int totalEvents;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "event_counts", nullable = false, columnDefinition = "jsonb")
    private Map<String, Integer> eventCounts = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "flow_counts", nullable = false, columnDefinition = "jsonb")
    private Map<String, Integer> flowCounts = new HashMap<>();

    @Column(name = "last_event_name")
    private String lastEventName;

    @Column(name = "last_flow")
    private String lastFlow;

    @Column(name = "last_status")
    private String lastStatus;

    @Column(name = "last_reason_code")
    private String lastReasonCode;

    @Column(name = "last_http_status")
    private Integer lastHttpStatus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "session_summary", nullable = false, columnDefinition = "jsonb")
    private List<SessionSummaryEntryDocument> sessionSummary = new ArrayList<>();

    @Column(nullable = false)
    private boolean deleted = false;

    @PrePersist
    void prePersist() {
        if (externalId == null) {
            externalId = UUID.randomUUID();
        }
        if (eventCounts == null) {
            eventCounts = new HashMap<>();
        }
        if (flowCounts == null) {
            flowCounts = new HashMap<>();
        }
        if (sessionSummary == null) {
            sessionSummary = new ArrayList<>();
        }
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
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

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }
}
