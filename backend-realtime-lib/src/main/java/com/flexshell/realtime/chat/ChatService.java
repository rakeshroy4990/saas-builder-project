package com.flexshell.realtime.chat;

import com.flexshell.compliance.PhiRetentionPolicy;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class ChatService {
    private final ObjectProvider<ChatPersistence> chatPersistenceProvider;
    private final PhiRetentionPolicy retentionPolicy;

    public ChatService(ObjectProvider<ChatPersistence> chatPersistenceProvider, PhiRetentionPolicy retentionPolicy) {
        this.chatPersistenceProvider = chatPersistenceProvider;
        this.retentionPolicy = retentionPolicy;
    }

    private ChatPersistence persistence() {
        ChatPersistence p = chatPersistenceProvider.getIfAvailable();
        if (p == null) {
            throw new IllegalStateException("Chat persistence is unavailable");
        }
        return p;
    }

    public ChatRoomEntity ensureDirectRoom(String userA, String userB) {
        String a = normalize(userA);
        String b = normalize(userB);
        if (a.isEmpty() || b.isEmpty()) throw new IllegalArgumentException("Missing participants");
        List<String> participants = List.of(a, b).stream().distinct().sorted().toList();
        if (participants.size() != 2) throw new IllegalArgumentException("Invalid participants");

        List<ChatRoomEntity> rooms = persistence().findRoomsByParticipant(a).stream()
                .filter(r -> r.getParticipants() != null && r.getParticipants().size() == 2
                        && r.getParticipants().containsAll(participants))
                .toList();
        if (!rooms.isEmpty()) {
            return rooms.stream()
                    .min(Comparator.comparing(ChatRoomEntity::getCreatedTimestamp, Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(rooms.get(0));
        }

        ChatRoomEntity room = new ChatRoomEntity();
        room.setParticipants(participants);
        room.setNextSequence(0L);
        room.setCreatedTimestamp(Instant.now());
        room.setUpdatedTimestamp(Instant.now());
        return persistence().saveRoom(room);
    }

    public List<ChatRoomEntity> listRoomsForUser(String userId) {
        String u = normalize(userId);
        if (u.isEmpty()) return List.of();
        return persistence().findRoomsByParticipant(u);
    }

    public List<ChatMessageEntity> loadRecentMessages(String roomId) {
        String rid = normalize(roomId);
        if (rid.isEmpty()) return List.of();
        return persistence().findRecentMessages(rid, 50).stream()
                .sorted(Comparator.comparingLong(ChatMessageEntity::getSequenceNumber))
                .toList();
    }

    public List<String> roomParticipants(String roomId) {
        String rid = normalize(roomId);
        if (rid.isEmpty()) return List.of();
        return persistence().findRoomById(rid)
                .map(room -> room.getParticipants() == null ? List.<String>of() : List.copyOf(room.getParticipants()))
                .orElse(List.of());
    }

    public ChatMessageEntity sendMessage(String roomId, String senderId, String body, String clientMessageId) {
        return sendMessage(roomId, senderId, body, clientMessageId, null);
    }

    public ChatMessageEntity sendMessage(
            String roomId,
            String senderId,
            String body,
            String clientMessageId,
            String messageId
    ) {
        String rid = normalize(roomId);
        String sid = normalize(senderId);
        String text = body == null ? "" : body.trim();
        if (rid.isEmpty() || sid.isEmpty() || text.isEmpty()) throw new IllegalArgumentException("Invalid message");

        ChatRoomEntity room = persistence().findRoomById(rid).orElseThrow(() -> new IllegalArgumentException("Room not found"));
        if (room.getParticipants() == null || !room.getParticipants().contains(sid)) {
            throw new IllegalStateException("Not a participant in this room");
        }

        Optional<ChatMessageEntity> existing = findExistingMessage(rid, normalize(clientMessageId), normalize(messageId));
        if (existing.isPresent()) {
            ChatMessageEntity msg = existing.get();
            if (!sid.equals(normalize(msg.getSenderId()))) {
                throw new IllegalStateException("Not permitted to update this message");
            }
            if (text.equals(String.valueOf(msg.getBody()).trim())) {
                return msg;
            }
            msg.setBody(text);
            return persistence().saveMessage(msg);
        }

        long seq = persistence().incrementRoomSequence(rid);
        ChatMessageEntity msg = new ChatMessageEntity();
        msg.setRoomId(rid);
        msg.setSenderId(sid);
        msg.setBody(text);
        msg.setClientMessageId(normalize(clientMessageId));
        msg.setSequenceNumber(seq);
        msg.setCreatedTimestamp(Instant.now());
        msg.setExpiresAt(retentionPolicy.expiresAtFromNow());
        return persistence().saveMessage(msg);
    }

    public void ack(String roomId, String userId, long upToSequenceNumber) {
        String rid = normalize(roomId);
        String uid = normalize(userId);
        if (rid.isEmpty() || uid.isEmpty()) return;
        if (upToSequenceNumber <= 0) return;

        ChatAckEntity ack = persistence().findAck(rid, uid).orElseGet(ChatAckEntity::new);
        ack.setRoomId(rid);
        ack.setUserId(uid);
        ack.setUpToSequenceNumber(Math.max(ack.getUpToSequenceNumber(), upToSequenceNumber));
        ack.setUpdatedTimestamp(Instant.now());
        persistence().saveAck(ack);
    }

    private Optional<ChatMessageEntity> findExistingMessage(String roomId, String clientMessageId, String messageId) {
        if (!clientMessageId.isEmpty()) {
            Optional<ChatMessageEntity> byClientId = persistence().findMessageByRoomAndClientMessageId(roomId, clientMessageId);
            if (byClientId.isPresent()) return byClientId;
        }
        if (!messageId.isEmpty()) {
            return persistence().findMessageByRoomAndId(roomId, messageId);
        }
        return Optional.empty();
    }

    private String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
