package com.flexshell.realtime.chat.support;

import java.util.Map;

public class SupportWsEvent {
    private String type;
    private String requestId;
    private String requesterUserId;
    private String requesterDisplayName;
    private String assignedAgentUserId;
    private String roomId;
    private Map<String, Object> meta;

    public static SupportWsEvent requestCreated(String requestId, String requesterUserId, String requesterDisplayName) {
        SupportWsEvent ev = new SupportWsEvent();
        ev.type = "support_request_created";
        ev.requestId = requestId;
        ev.requesterUserId = requesterUserId;
        ev.requesterDisplayName = requesterDisplayName;
        return ev;
    }

    public static SupportWsEvent assigned(String requestId, String requesterUserId, String requesterDisplayName, String assignedAgentUserId, String roomId) {
        SupportWsEvent ev = new SupportWsEvent();
        ev.type = "support_request_assigned";
        ev.requestId = requestId;
        ev.requesterUserId = requesterUserId;
        ev.requesterDisplayName = requesterDisplayName;
        ev.assignedAgentUserId = assignedAgentUserId;
        ev.roomId = roomId;
        return ev;
    }

    public static SupportWsEvent closed(String requestId, String requesterUserId, String requesterDisplayName, String closedByUserId) {
        SupportWsEvent ev = new SupportWsEvent();
        ev.type = "support_request_closed";
        ev.requestId = requestId;
        ev.requesterUserId = requesterUserId;
        ev.requesterDisplayName = requesterDisplayName;
        ev.assignedAgentUserId = closedByUserId;
        return ev;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getRequesterUserId() {
        return requesterUserId;
    }

    public void setRequesterUserId(String requesterUserId) {
        this.requesterUserId = requesterUserId;
    }

    public String getAssignedAgentUserId() {
        return assignedAgentUserId;
    }

    public void setAssignedAgentUserId(String assignedAgentUserId) {
        this.assignedAgentUserId = assignedAgentUserId;
    }

    public String getRequesterDisplayName() {
        return requesterDisplayName;
    }

    public void setRequesterDisplayName(String requesterDisplayName) {
        this.requesterDisplayName = requesterDisplayName;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public Map<String, Object> getMeta() {
        return meta;
    }

    public void setMeta(Map<String, Object> meta) {
        this.meta = meta;
    }
}

