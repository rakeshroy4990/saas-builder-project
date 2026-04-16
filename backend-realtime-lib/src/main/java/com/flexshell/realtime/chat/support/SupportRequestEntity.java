package com.flexshell.realtime.chat.support;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "support_chat_requests")
public class SupportRequestEntity {
    @Id
    private String id;

    @Field("RequesterUserId")
    private String requesterUserId;

    @Field("AssignedAgentUserId")
    private String assignedAgentUserId;

    @Field("Status")
    private SupportRequestStatus status = SupportRequestStatus.OPEN;

    @Field("CreatedTimestamp")
    private Instant createdTimestamp;

    @Field("UpdatedTimestamp")
    private Instant updatedTimestamp;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public SupportRequestStatus getStatus() {
        return status;
    }

    public void setStatus(SupportRequestStatus status) {
        this.status = status;
    }

    public Instant getCreatedTimestamp() {
        return createdTimestamp;
    }

    public void setCreatedTimestamp(Instant createdTimestamp) {
        this.createdTimestamp = createdTimestamp;
    }

    public Instant getUpdatedTimestamp() {
        return updatedTimestamp;
    }

    public void setUpdatedTimestamp(Instant updatedTimestamp) {
        this.updatedTimestamp = updatedTimestamp;
    }
}

