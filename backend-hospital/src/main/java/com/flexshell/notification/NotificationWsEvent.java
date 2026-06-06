package com.flexshell.notification;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public class NotificationWsEvent {

    @JsonProperty("ExternalId")
    private UUID externalId;

    @JsonProperty("EventType")
    private String eventType;

    @JsonProperty("Title")
    private String title;

    @JsonProperty("Message")
    private String message;

    @JsonProperty("EntityType")
    private String entityType;

    @JsonProperty("EntityExternalId")
    private UUID entityExternalId;

    @JsonProperty("EntityRefId")
    private String entityRefId;

    @JsonProperty("IsRead")
    private boolean read;

    @JsonProperty("CreatedAt")
    private Instant createdAt;

    @JsonProperty("UnreadCount")
    private long unreadCount;

    public UUID getExternalId() {
        return externalId;
    }

    public void setExternalId(UUID externalId) {
        this.externalId = externalId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public UUID getEntityExternalId() {
        return entityExternalId;
    }

    public void setEntityExternalId(UUID entityExternalId) {
        this.entityExternalId = entityExternalId;
    }

    public String getEntityRefId() {
        return entityRefId;
    }

    public void setEntityRefId(String entityRefId) {
        this.entityRefId = entityRefId;
    }

    public boolean isRead() {
        return read;
    }

    public void setRead(boolean read) {
        this.read = read;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public long getUnreadCount() {
        return unreadCount;
    }

    public void setUnreadCount(long unreadCount) {
        this.unreadCount = unreadCount;
    }
}
