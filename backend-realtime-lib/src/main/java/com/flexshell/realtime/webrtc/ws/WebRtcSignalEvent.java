package com.flexshell.realtime.webrtc.ws;

import java.time.Instant;
import java.util.Map;

public class WebRtcSignalEvent {
    private String type = "webrtc.signal";
    private String signalType;
    private String callId;
    private String fromUserId;
    private String toUserId;
    private Map<String, Object> payload;
    private Instant createdTimestamp = Instant.now();

    public String getType() {
        return type;
    }

    public String getSignalType() {
        return signalType;
    }

    public void setSignalType(String signalType) {
        this.signalType = signalType;
    }

    public String getCallId() {
        return callId;
    }

    public void setCallId(String callId) {
        this.callId = callId;
    }

    public String getFromUserId() {
        return fromUserId;
    }

    public void setFromUserId(String fromUserId) {
        this.fromUserId = fromUserId;
    }

    public String getToUserId() {
        return toUserId;
    }

    public void setToUserId(String toUserId) {
        this.toUserId = toUserId;
    }

    public Map<String, Object> getPayload() {
        return payload;
    }

    public void setPayload(Map<String, Object> payload) {
        this.payload = payload;
    }

    public Instant getCreatedTimestamp() {
        return createdTimestamp;
    }
}

