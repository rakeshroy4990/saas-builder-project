package com.flexshell.realtime.chat;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@ConditionalOnBean(ChatRoomRepository.class)
public class MongoChatPersistence implements ChatPersistence {

    private final ChatRoomRepository roomRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatAckRepository ackRepository;
    private final MongoTemplate mongoTemplate;

    public MongoChatPersistence(
            ChatRoomRepository roomRepository,
            ChatMessageRepository messageRepository,
            ChatAckRepository ackRepository,
            MongoTemplate mongoTemplate
    ) {
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.ackRepository = ackRepository;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public ChatRoomEntity saveRoom(ChatRoomEntity room) {
        return roomRepository.save(room);
    }

    @Override
    public Optional<ChatRoomEntity> findRoomById(String roomId) {
        return roomRepository.findById(normalize(roomId));
    }

    @Override
    public List<ChatRoomEntity> findRoomsByParticipant(String userId) {
        return roomRepository.findByParticipantsContaining(normalize(userId));
    }

    @Override
    public long incrementRoomSequence(String roomId) {
        Query q = new Query(Criteria.where("_id").is(normalize(roomId)));
        Update u = new Update()
                .inc("NextSequence", 1)
                .set("UpdatedTimestamp", Instant.now());
        ChatRoomEntity updated = mongoTemplate.findAndModify(
                q,
                u,
                FindAndModifyOptions.options().returnNew(true),
                ChatRoomEntity.class
        );
        if (updated == null) {
            throw new IllegalStateException("Unable to increment sequence");
        }
        return updated.getNextSequence();
    }

    @Override
    public ChatMessageEntity saveMessage(ChatMessageEntity message) {
        return messageRepository.save(message);
    }

    @Override
    public Optional<ChatMessageEntity> findMessageByRoomAndClientMessageId(String roomId, String clientMessageId) {
        String rid = normalize(roomId);
        String cmid = normalize(clientMessageId);
        if (rid.isEmpty() || cmid.isEmpty()) return Optional.empty();
        return messageRepository.findFirstByRoomIdAndClientMessageId(rid, cmid);
    }

    @Override
    public Optional<ChatMessageEntity> findMessageByRoomAndId(String roomId, String messageId) {
        String rid = normalize(roomId);
        String mid = normalize(messageId);
        if (rid.isEmpty() || mid.isEmpty()) return Optional.empty();
        return messageRepository.findById(mid)
                .filter(msg -> rid.equals(normalize(msg.getRoomId())));
    }

    @Override
    public List<ChatMessageEntity> findRecentMessages(String roomId, int limit) {
        int capped = Math.max(1, Math.min(limit, 100));
        return messageRepository.findTop50ByRoomIdOrderBySequenceNumberDesc(normalize(roomId))
                .stream()
                .limit(capped)
                .toList();
    }

    @Override
    public ChatAckEntity saveAck(ChatAckEntity ack) {
        return ackRepository.save(ack);
    }

    @Override
    public Optional<ChatAckEntity> findAck(String roomId, String userId) {
        return ackRepository.findByRoomIdAndUserId(normalize(roomId), normalize(userId));
    }

    private String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
