package com.flexshell.realtime.chat;

import com.flexshell.compliance.PhiRetentionPolicy;
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
    private final ChatRoomRepository roomRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatAckRepository ackRepository;
    private final MongoTemplate mongoTemplate;
    private final PhiRetentionPolicy retentionPolicy;

    public ChatService(
            ChatRoomRepository roomRepository,
            ChatMessageRepository messageRepository,
            ChatAckRepository ackRepository,
            MongoTemplate mongoTemplate,
            PhiRetentionPolicy retentionPolicy
    ) {
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.ackRepository = ackRepository;
        this.mongoTemplate = mongoTemplate;
        this.retentionPolicy = retentionPolicy;
    }

    public ChatRoomEntity ensureDirectRoom(String userA, String userB) {
        String a = normalize(userA);
        String b = normalize(userB);
        if (a.isEmpty() || b.isEmpty()) throw new IllegalArgumentException("Missing participants");
        List<String> participants = List.of(a, b).stream().distinct().sorted().toList();
        if (participants.size() != 2) throw new IllegalArgumentException("Invalid participants");

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
        return roomRepository.save(room);
    }

    public List<ChatRoomEntity> listRoomsForUser(String userId) {
        String u = normalize(userId);
        if (u.isEmpty()) return List.of();
        return roomRepository.findByParticipantsContaining(u);
    }

    public List<ChatMessageEntity> loadRecentMessages(String roomId) {
        String rid = normalize(roomId);
        if (rid.isEmpty()) return List.of();
        List<ChatMessageEntity> recent = messageRepository.findTop50ByRoomIdOrderBySequenceNumberDesc(rid);
        recent.sort(Comparator.comparingLong(ChatMessageEntity::getSequenceNumber));
        return recent;
    }

    public ChatMessageEntity sendMessage(String roomId, String senderId, String body, String clientMessageId) {
        String rid = normalize(roomId);
        String sid = normalize(senderId);
        String text = body == null ? "" : body.trim();
        if (rid.isEmpty() || sid.isEmpty() || text.isEmpty()) throw new IllegalArgumentException("Invalid message");

        ChatRoomEntity room = roomRepository.findById(rid).orElseThrow(() -> new IllegalArgumentException("Room not found"));
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
        return messageRepository.save(msg);
    }

    public void ack(String roomId, String userId, long upToSequenceNumber) {
        String rid = normalize(roomId);
        String uid = normalize(userId);
        if (rid.isEmpty() || uid.isEmpty()) return;
        if (upToSequenceNumber <= 0) return;

        ChatAckEntity ack = ackRepository.findByRoomIdAndUserId(rid, uid).orElseGet(ChatAckEntity::new);
        ack.setRoomId(rid);
        ack.setUserId(uid);
        ack.setUpToSequenceNumber(Math.max(ack.getUpToSequenceNumber(), upToSequenceNumber));
        ack.setUpdatedTimestamp(Instant.now());
        ackRepository.save(ack);
    }

    private long nextSequence(String roomId) {
        Query q = new Query(Criteria.where("_id").is(roomId));
        Update u = new Update()
                .inc("NextSequence", 1)
                .set("UpdatedTimestamp", Instant.now());
        ChatRoomEntity updated = mongoTemplate.findAndModify(
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

