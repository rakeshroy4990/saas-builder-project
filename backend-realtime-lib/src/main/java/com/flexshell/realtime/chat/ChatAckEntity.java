package com.flexshell.realtime.chat;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;

@Document(collection = "chat_acks")
public class ChatAckEntity {
    @Id
    private String id;

    @Field("RoomId")
    private String roomId;

    @Field("UserId")
    private String userId;

    @Field("UpToSequenceNumber")
    private long upToSequenceNumber;

    @Field("UpdatedTimestamp")
    private Instant updatedTimestamp;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public long getUpToSequenceNumber() {
        return upToSequenceNumber;
    }

    public void setUpToSequenceNumber(long upToSequenceNumber) {
        this.upToSequenceNumber = upToSequenceNumber;
    }

    public Instant getUpdatedTimestamp() {
        return updatedTimestamp;
    }

    public void setUpdatedTimestamp(Instant updatedTimestamp) {
        this.updatedTimestamp = updatedTimestamp;
    }
}

