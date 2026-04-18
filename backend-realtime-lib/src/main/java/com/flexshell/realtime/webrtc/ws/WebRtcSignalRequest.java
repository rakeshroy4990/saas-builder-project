package com.flexshell.realtime.webrtc.ws;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.Map;

public class WebRtcSignalRequest {
    @JsonAlias({"Type"})
    private String type;

    @JsonAlias({"CallId"})
    private String callId;

    @JsonAlias({"ToUserId"})
    private String toUserId;

    @JsonAlias({"Payload", "payload"})
    private Map<String, Object> payload;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCallId() {
        return callId;
    }

    public void setCallId(String callId) {
        this.callId = callId;
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
}

