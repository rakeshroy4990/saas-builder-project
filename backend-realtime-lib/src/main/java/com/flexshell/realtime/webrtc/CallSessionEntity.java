package com.flexshell.realtime.webrtc;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "call_sessions")
public class CallSessionEntity {
    @Id
    private String callId;

    @Field("InitiatorId")
    private String initiatorId;

    @Field("ReceiverId")
    private String receiverId;

    @Field("StartTime")
    private Instant startTime;

    @Field("EndTime")
    private Instant endTime;

    @Field("Status")
    private CallSessionStatus status = CallSessionStatus.RINGING;

    @Field("EndedReason")
    private String endedReason;

    @Field("ExpiresAt")
    @Indexed(expireAfterSeconds = 0)
    private Instant expiresAt;

    public String getCallId() {
        return callId;
    }

    public void setCallId(String callId) {
        this.callId = callId;
    }

    public String getInitiatorId() {
        return initiatorId;
    }

    public void setInitiatorId(String initiatorId) {
        this.initiatorId = initiatorId;
    }

    public String getReceiverId() {
        return receiverId;
    }

    public void setReceiverId(String receiverId) {
        this.receiverId = receiverId;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public void setStartTime(Instant startTime) {
        this.startTime = startTime;
    }

    public Instant getEndTime() {
        return endTime;
    }

    public void setEndTime(Instant endTime) {
        this.endTime = endTime;
    }

    public CallSessionStatus getStatus() {
        return status;
    }

    public void setStatus(CallSessionStatus status) {
        this.status = status;
    }

    public String getEndedReason() {
        return endedReason;
    }

    public void setEndedReason(String endedReason) {
        this.endedReason = endedReason;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}

