package com.flexshell.realtime.chat;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "chat_rooms")
public class ChatRoomEntity {
    @Id
    private String id;

    @Field("Participants")
    private List<String> participants = new ArrayList<>();

    @Field("NextSequence")
    private long nextSequence = 0L;

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

    public List<String> getParticipants() {
        return participants;
    }

    public void setParticipants(List<String> participants) {
        this.participants = participants == null ? new ArrayList<>() : new ArrayList<>(participants);
    }

    public long getNextSequence() {
        return nextSequence;
    }

    public void setNextSequence(long nextSequence) {
        this.nextSequence = nextSequence;
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

