package com.flexshell.realtime.chat.ws;

public class ChatAckRequest {
    private String roomId;
    private long upToSequenceNumber;

    public String getRoomId() {
        return roomId;
    }

    public void setRoomId(String roomId) {
        this.roomId = roomId;
    }

    public long getUpToSequenceNumber() {
        return upToSequenceNumber;
    }

    public void setUpToSequenceNumber(long upToSequenceNumber) {
        this.upToSequenceNumber = upToSequenceNumber;
    }
}

