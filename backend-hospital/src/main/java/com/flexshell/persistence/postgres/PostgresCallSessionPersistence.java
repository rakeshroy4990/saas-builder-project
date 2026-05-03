package com.flexshell.persistence.postgres;

import com.flexshell.persistence.postgres.model.CallSessionJpaEntity;
import com.flexshell.persistence.postgres.repository.CallSessionJpaRepository;
import com.flexshell.realtime.webrtc.CallSessionEntity;
import com.flexshell.realtime.webrtc.CallSessionPersistence;
import com.flexshell.realtime.webrtc.CallSessionStatus;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresCallSessionPersistence implements CallSessionPersistence {

    private final CallSessionJpaRepository jpaRepository;

    public PostgresCallSessionPersistence(CallSessionJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public CallSessionEntity save(CallSessionEntity entity) {
        String id = entity.getCallId();
        if (id == null || id.isBlank()) {
            id = UUID.randomUUID().toString();
            entity.setCallId(id);
        }
        Optional<CallSessionJpaEntity> existing = jpaRepository.findById(id);
        CallSessionJpaEntity row = existing.orElseGet(CallSessionJpaEntity::new);
        copyToRow(entity, row);
        CallSessionJpaEntity saved = jpaRepository.save(row);
        return fromRow(saved);
    }

    @Override
    public Optional<CallSessionEntity> findById(String callId) {
        return jpaRepository.findByCallIdAndDeletedFalse(callId).map(this::fromRow);
    }

    private void copyToRow(CallSessionEntity src, CallSessionJpaEntity dest) {
        dest.setCallId(src.getCallId());
        dest.setInitiatorId(src.getInitiatorId());
        dest.setReceiverId(src.getReceiverId());
        dest.setStartTime(src.getStartTime());
        dest.setEndTime(src.getEndTime());
        dest.setStatus(src.getStatus() != null ? src.getStatus().name() : CallSessionStatus.RINGING.name());
        dest.setEndedReason(src.getEndedReason());
        dest.setExpiresAt(src.getExpiresAt());
        dest.setDeleted(false);
    }

    private CallSessionEntity fromRow(CallSessionJpaEntity row) {
        CallSessionEntity e = new CallSessionEntity();
        e.setCallId(row.getCallId());
        e.setInitiatorId(row.getInitiatorId());
        e.setReceiverId(row.getReceiverId());
        e.setStartTime(row.getStartTime());
        e.setEndTime(row.getEndTime());
        e.setStatus(parseStatus(row.getStatus()));
        e.setEndedReason(row.getEndedReason());
        e.setExpiresAt(row.getExpiresAt());
        return e;
    }

    private static CallSessionStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return CallSessionStatus.RINGING;
        }
        try {
            return CallSessionStatus.valueOf(raw.trim());
        } catch (IllegalArgumentException ex) {
            return CallSessionStatus.RINGING;
        }
    }
}
