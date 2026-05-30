package com.flexshell.persistence.postgres;

import com.flexshell.persistence.postgres.model.SupportChatRequestJpaEntity;
import com.flexshell.persistence.postgres.repository.SupportChatRequestJpaRepository;
import com.flexshell.realtime.chat.support.SupportChatPersistence;
import com.flexshell.realtime.chat.support.SupportRequestEntity;
import com.flexshell.realtime.chat.support.SupportRequestStatus;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresSupportChatPersistence implements SupportChatPersistence {

    private final SupportChatRequestJpaRepository repository;

    public PostgresSupportChatPersistence(SupportChatRequestJpaRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public SupportRequestEntity save(SupportRequestEntity request) {
        SupportChatRequestJpaEntity row = new SupportChatRequestJpaEntity();
        if (request.getId() != null && !request.getId().isBlank()) {
            row.setId(request.getId().trim());
        }
        copyToRow(request, row);
        SupportChatRequestJpaEntity saved = repository.save(row);
        return fromRow(saved);
    }

    @Override
    @Transactional
    public Optional<SupportRequestEntity> claimOpenRequest(String requestId, String agentUserId) {
        return modifyOpenRequest(requestId, agentUserId, SupportRequestStatus.ASSIGNED);
    }

    @Override
    @Transactional
    public Optional<SupportRequestEntity> closeOpenRequest(String requestId, String agentUserId) {
        return modifyOpenRequest(requestId, agentUserId, SupportRequestStatus.CLOSED);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<SupportRequestEntity> findRequestById(String requestId) {
        String rid = normalize(requestId);
        if (rid.isEmpty()) {
            return Optional.empty();
        }
        return repository.findById(rid).filter(row -> !row.isDeleted()).map(this::fromRow);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SupportRequestEntity> listOpenRequests(int limit) {
        int capped = Math.max(1, Math.min(limit, 50));
        return repository.findTop20ByStatusAndDeletedFalseOrderByCreatedAtDesc(SupportRequestStatus.OPEN.name())
                .stream()
                .limit(capped)
                .map(this::fromRow)
                .toList();
    }

    private Optional<SupportRequestEntity> modifyOpenRequest(
            String requestId,
            String agentUserId,
            SupportRequestStatus nextStatus
    ) {
        String rid = normalize(requestId);
        String agent = normalize(agentUserId);
        if (rid.isEmpty() || agent.isEmpty()) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        int updated = repository.updateOpenRequest(
                rid,
                agent,
                nextStatus.name(),
                SupportRequestStatus.OPEN.name(),
                now
        );
        if (updated != 1) {
            return Optional.empty();
        }
        return repository.findById(rid).map(this::fromRow);
    }

    private void copyToRow(SupportRequestEntity src, SupportChatRequestJpaEntity dest) {
        dest.setRequesterUserId(normalize(src.getRequesterUserId()));
        dest.setAssignedAgentUserId(blankToNull(src.getAssignedAgentUserId()));
        dest.setStatus(src.getStatus() != null ? src.getStatus().name() : SupportRequestStatus.OPEN.name());
        dest.setCreatedAt(src.getCreatedTimestamp() != null ? src.getCreatedTimestamp() : Instant.now());
        dest.setUpdatedAt(src.getUpdatedTimestamp() != null ? src.getUpdatedTimestamp() : Instant.now());
        dest.setDeleted(false);
    }

    private SupportRequestEntity fromRow(SupportChatRequestJpaEntity row) {
        SupportRequestEntity entity = new SupportRequestEntity();
        entity.setId(row.getId());
        entity.setRequesterUserId(row.getRequesterUserId());
        entity.setAssignedAgentUserId(row.getAssignedAgentUserId());
        entity.setStatus(parseStatus(row.getStatus()));
        entity.setCreatedTimestamp(row.getCreatedAt());
        entity.setUpdatedTimestamp(row.getUpdatedAt());
        return entity;
    }

    private static SupportRequestStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return SupportRequestStatus.OPEN;
        }
        try {
            return SupportRequestStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return SupportRequestStatus.OPEN;
        }
    }

    private static String blankToNull(String value) {
        String normalized = normalize(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private static String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
