package com.flexshell.persistence.postgres;

import com.flexshell.persistence.postgres.model.ChatAckJpaEntity;
import com.flexshell.persistence.postgres.model.ChatMessageJpaEntity;
import com.flexshell.persistence.postgres.model.ChatRoomJpaEntity;
import com.flexshell.persistence.postgres.repository.ChatAckJpaRepository;
import com.flexshell.persistence.postgres.repository.ChatMessageJpaRepository;
import com.flexshell.persistence.postgres.repository.ChatRoomJpaRepository;
import com.flexshell.realtime.chat.ChatAckEntity;
import com.flexshell.realtime.chat.ChatMessageEntity;
import com.flexshell.realtime.chat.ChatPersistence;
import com.flexshell.realtime.chat.ChatRoomEntity;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresChatPersistence implements ChatPersistence {

    private final ChatRoomJpaRepository roomRepository;
    private final ChatMessageJpaRepository messageRepository;
    private final ChatAckJpaRepository ackRepository;

    public PostgresChatPersistence(
            ChatRoomJpaRepository roomRepository,
            ChatMessageJpaRepository messageRepository,
            ChatAckJpaRepository ackRepository
    ) {
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.ackRepository = ackRepository;
    }

    @Override
    @Transactional
    public ChatRoomEntity saveRoom(ChatRoomEntity room) {
        ChatRoomJpaEntity row = new ChatRoomJpaEntity();
        if (room.getId() != null && !room.getId().isBlank()) {
            row.setId(room.getId().trim());
        }
        copyRoomToRow(room, row);
        ChatRoomJpaEntity saved = roomRepository.save(row);
        return roomFromRow(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ChatRoomEntity> findRoomById(String roomId) {
        return roomRepository.findByIdAndDeletedFalse(normalize(roomId)).map(this::roomFromRow);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatRoomEntity> findRoomsByParticipant(String userId) {
        String uid = normalize(userId);
        if (uid.isEmpty()) {
            return List.of();
        }
        return roomRepository.findByParticipant(uid).stream().map(this::roomFromRow).toList();
    }

    @Override
    @Transactional
    public long incrementRoomSequence(String roomId) {
        String rid = normalize(roomId);
        if (rid.isEmpty()) {
            throw new IllegalArgumentException("Missing roomId");
        }
        int updated = roomRepository.incrementNextSequence(rid, Instant.now());
        if (updated != 1) {
            throw new IllegalStateException("Unable to increment sequence");
        }
        return roomRepository.findByIdAndDeletedFalse(rid)
                .map(ChatRoomJpaEntity::getNextSequence)
                .orElseThrow(() -> new IllegalStateException("Unable to increment sequence"));
    }

    @Override
    @Transactional
    public ChatMessageEntity saveMessage(ChatMessageEntity message) {
        ChatMessageJpaEntity row = null;
        if (message.getId() != null && !message.getId().isBlank()) {
            row = messageRepository.findById(message.getId().trim()).orElse(null);
        }
        if (row == null) {
            row = new ChatMessageJpaEntity();
            if (message.getId() != null && !message.getId().isBlank()) {
                row.setId(message.getId().trim());
            }
        }
        copyMessageToRow(message, row);
        ChatMessageJpaEntity saved = messageRepository.save(row);
        return messageFromRow(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ChatMessageEntity> findMessageByRoomAndClientMessageId(String roomId, String clientMessageId) {
        String rid = normalize(roomId);
        String cmid = normalize(clientMessageId);
        if (rid.isEmpty() || cmid.isEmpty()) return Optional.empty();
        return messageRepository.findByRoomIdAndClientMessageIdAndDeletedFalse(rid, cmid)
                .map(this::messageFromRow);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessageEntity> findRecentMessages(String roomId, int limit) {
        int capped = Math.max(1, Math.min(limit, 100));
        return messageRepository.findTop50ByRoomIdAndDeletedFalseOrderBySequenceNumberDesc(normalize(roomId))
                .stream()
                .limit(capped)
                .map(this::messageFromRow)
                .toList();
    }

    @Override
    @Transactional
    public ChatAckEntity saveAck(ChatAckEntity ack) {
        ChatAckJpaEntity row = ackRepository.findByRoomIdAndUserIdAndDeletedFalse(
                normalize(ack.getRoomId()),
                normalize(ack.getUserId())
        ).orElseGet(ChatAckJpaEntity::new);
        if (row.getId() == null || row.getId().isBlank()) {
            row.setId(null);
        }
        copyAckToRow(ack, row);
        ChatAckJpaEntity saved = ackRepository.save(row);
        return ackFromRow(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ChatAckEntity> findAck(String roomId, String userId) {
        return ackRepository.findByRoomIdAndUserIdAndDeletedFalse(normalize(roomId), normalize(userId))
                .map(this::ackFromRow);
    }

    private void copyRoomToRow(ChatRoomEntity src, ChatRoomJpaEntity dest) {
        dest.setParticipants(src.getParticipants() == null ? new ArrayList<>() : new ArrayList<>(src.getParticipants()));
        dest.setNextSequence(src.getNextSequence());
        dest.setCreatedAt(src.getCreatedTimestamp() != null ? src.getCreatedTimestamp() : Instant.now());
        dest.setUpdatedAt(src.getUpdatedTimestamp() != null ? src.getUpdatedTimestamp() : Instant.now());
        dest.setDeleted(false);
    }

    private ChatRoomEntity roomFromRow(ChatRoomJpaEntity row) {
        ChatRoomEntity entity = new ChatRoomEntity();
        entity.setId(row.getId());
        entity.setParticipants(row.getParticipants() == null ? new ArrayList<>() : new ArrayList<>(row.getParticipants()));
        entity.setNextSequence(row.getNextSequence());
        entity.setCreatedTimestamp(row.getCreatedAt());
        entity.setUpdatedTimestamp(row.getUpdatedAt());
        return entity;
    }

    private void copyMessageToRow(ChatMessageEntity src, ChatMessageJpaEntity dest) {
        dest.setRoomId(normalize(src.getRoomId()));
        dest.setSequenceNumber(src.getSequenceNumber());
        dest.setSenderId(normalize(src.getSenderId()));
        dest.setBody(src.getBody());
        dest.setClientMessageId(blankToNull(src.getClientMessageId()));
        dest.setCreatedAt(src.getCreatedTimestamp() != null ? src.getCreatedTimestamp() : Instant.now());
        dest.setExpiresAt(src.getExpiresAt());
        dest.setDeleted(false);
    }

    private ChatMessageEntity messageFromRow(ChatMessageJpaEntity row) {
        ChatMessageEntity entity = new ChatMessageEntity();
        entity.setId(row.getId());
        entity.setRoomId(row.getRoomId());
        entity.setSequenceNumber(row.getSequenceNumber());
        entity.setSenderId(row.getSenderId());
        entity.setBody(row.getBody());
        entity.setClientMessageId(row.getClientMessageId());
        entity.setCreatedTimestamp(row.getCreatedAt());
        entity.setExpiresAt(row.getExpiresAt());
        return entity;
    }

    private void copyAckToRow(ChatAckEntity src, ChatAckJpaEntity dest) {
        dest.setRoomId(normalize(src.getRoomId()));
        dest.setUserId(normalize(src.getUserId()));
        dest.setUpToSequence(src.getUpToSequenceNumber());
        dest.setUpdatedAt(src.getUpdatedTimestamp() != null ? src.getUpdatedTimestamp() : Instant.now());
        dest.setDeleted(false);
    }

    private ChatAckEntity ackFromRow(ChatAckJpaEntity row) {
        ChatAckEntity entity = new ChatAckEntity();
        entity.setId(row.getId());
        entity.setRoomId(row.getRoomId());
        entity.setUserId(row.getUserId());
        entity.setUpToSequenceNumber(row.getUpToSequence());
        entity.setUpdatedTimestamp(row.getUpdatedAt());
        return entity;
    }

    private static String blankToNull(String value) {
        String normalized = normalize(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private static String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
