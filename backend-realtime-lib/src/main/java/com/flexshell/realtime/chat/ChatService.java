package com.flexshell.realtime.chat;

import com.flexshell.compliance.PhiRetentionPolicy;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class ChatService {
    private final ObjectProvider<ChatRoomRepository> roomRepositoryProvider;
    private final ObjectProvider<ChatMessageRepository> messageRepositoryProvider;
    private final ObjectProvider<ChatAckRepository> ackRepositoryProvider;
    private final ObjectProvider<MongoTemplate> mongoTemplateProvider;
    private final PhiRetentionPolicy retentionPolicy;

    public ChatService(
            ObjectProvider<ChatRoomRepository> roomRepositoryProvider,
            ObjectProvider<ChatMessageRepository> messageRepositoryProvider,
            ObjectProvider<ChatAckRepository> ackRepositoryProvider,
            ObjectProvider<MongoTemplate> mongoTemplateProvider,
            PhiRetentionPolicy retentionPolicy
    ) {
        this.roomRepositoryProvider = roomRepositoryProvider;
        this.messageRepositoryProvider = messageRepositoryProvider;
        this.ackRepositoryProvider = ackRepositoryProvider;
        this.mongoTemplateProvider = mongoTemplateProvider;
        this.retentionPolicy = retentionPolicy;
    }

    private ChatRoomRepository rooms() {
        ChatRoomRepository r = roomRepositoryProvider.getIfAvailable();
        if (r == null) {
            throw new IllegalStateException("Chat persistence is unavailable");
        }
        return r;
    }

    private ChatMessageRepository messages() {
        ChatMessageRepository r = messageRepositoryProvider.getIfAvailable();
        if (r == null) {
            throw new IllegalStateException("Chat persistence is unavailable");
        }
        return r;
    }

    private ChatAckRepository acks() {
        ChatAckRepository r = ackRepositoryProvider.getIfAvailable();
        if (r == null) {
            throw new IllegalStateException("Chat persistence is unavailable");
        }
        return r;
    }

    private MongoTemplate mongo() {
        MongoTemplate t = mongoTemplateProvider.getIfAvailable();
        if (t == null) {
            throw new IllegalStateException("MongoDB template is unavailable");
        }
        return t;
    }

    public ChatRoomEntity ensureDirectRoom(String userA, String userB) {
        String a = normalize(userA);
        String b = normalize(userB);
        if (a.isEmpty() || b.isEmpty()) throw new IllegalArgumentException("Missing participants");
        List<String> participants = List.of(a, b).stream().distinct().sorted().toList();
        if (participants.size() != 2) throw new IllegalArgumentException("Invalid participants");

        ChatRoomRepository roomRepository = rooms();
        List<ChatRoomEntity> rooms = roomRepository.findByParticipantsContaining(a).stream()
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
        return rooms().save(room);
    }

    public List<ChatRoomEntity> listRoomsForUser(String userId) {
        String u = normalize(userId);
        if (u.isEmpty()) return List.of();
        return rooms().findByParticipantsContaining(u);
    }

    public List<ChatMessageEntity> loadRecentMessages(String roomId) {
        String rid = normalize(roomId);
        if (rid.isEmpty()) return List.of();
        List<ChatMessageEntity> recent = messages().findTop50ByRoomIdOrderBySequenceNumberDesc(rid);
        recent.sort(Comparator.comparingLong(ChatMessageEntity::getSequenceNumber));
        return recent;
    }

    public ChatMessageEntity sendMessage(String roomId, String senderId, String body, String clientMessageId) {
        String rid = normalize(roomId);
        String sid = normalize(senderId);
        String text = body == null ? "" : body.trim();
        if (rid.isEmpty() || sid.isEmpty() || text.isEmpty()) throw new IllegalArgumentException("Invalid message");

        ChatRoomEntity room = rooms().findById(rid).orElseThrow(() -> new IllegalArgumentException("Room not found"));
        if (room.getParticipants() == null || !room.getParticipants().contains(sid)) {
            throw new IllegalStateException("Not a participant in this room");
        }

        long seq = nextSequence(rid);
        ChatMessageEntity msg = new ChatMessageEntity();
        msg.setRoomId(rid);
        msg.setSenderId(sid);
        msg.setBody(text);
        msg.setClientMessageId(normalize(clientMessageId));
        msg.setSequenceNumber(seq);
        msg.setCreatedTimestamp(Instant.now());
        msg.setExpiresAt(retentionPolicy.expiresAtFromNow());
        return messages().save(msg);
    }

    public void ack(String roomId, String userId, long upToSequenceNumber) {
        String rid = normalize(roomId);
        String uid = normalize(userId);
        if (rid.isEmpty() || uid.isEmpty()) return;
        if (upToSequenceNumber <= 0) return;

        ChatAckEntity ack = acks().findByRoomIdAndUserId(rid, uid).orElseGet(ChatAckEntity::new);
        ack.setRoomId(rid);
        ack.setUserId(uid);
        ack.setUpToSequenceNumber(Math.max(ack.getUpToSequenceNumber(), upToSequenceNumber));
        ack.setUpdatedTimestamp(Instant.now());
        acks().save(ack);
    }

    private long nextSequence(String roomId) {
        Query q = new Query(Criteria.where("_id").is(roomId));
        Update u = new Update()
                .inc("NextSequence", 1)
                .set("UpdatedTimestamp", Instant.now());
        ChatRoomEntity updated = mongo().findAndModify(
                q,
                u,
                FindAndModifyOptions.options().returnNew(true),
                ChatRoomEntity.class
        );
        if (updated == null) throw new IllegalStateException("Unable to increment sequence");
        return updated.getNextSequence();
    }

    private String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}

