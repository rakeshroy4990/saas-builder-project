package com.flexshell.realtime.chat.support;

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
@ConditionalOnBean(SupportRequestRepository.class)
public class MongoSupportChatPersistence implements SupportChatPersistence {

    private final SupportRequestRepository repository;
    private final MongoTemplate mongoTemplate;

    public MongoSupportChatPersistence(SupportRequestRepository repository, MongoTemplate mongoTemplate) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public SupportRequestEntity save(SupportRequestEntity request) {
        return repository.save(request);
    }

    @Override
    public Optional<SupportRequestEntity> claimOpenRequest(String requestId, String agentUserId) {
        return modifyOpenRequest(requestId, agentUserId, SupportRequestStatus.ASSIGNED);
    }

    @Override
    public Optional<SupportRequestEntity> closeOpenRequest(String requestId, String agentUserId) {
        return modifyOpenRequest(requestId, agentUserId, SupportRequestStatus.CLOSED);
    }

    @Override
    public Optional<SupportRequestEntity> findRequestById(String requestId) {
        String rid = normalize(requestId);
        if (rid.isEmpty()) {
            return Optional.empty();
        }
        return repository.findById(rid);
    }

    @Override
    public List<SupportRequestEntity> listOpenRequests(int limit) {
        int capped = Math.max(1, Math.min(limit, 50));
        return repository.findTop20ByStatusOrderByCreatedTimestampDesc(SupportRequestStatus.OPEN)
                .stream()
                .limit(capped)
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
        Query q = new Query(Criteria.where("_id").is(rid).and("Status").is(SupportRequestStatus.OPEN));
        Update u = new Update()
                .set("Status", nextStatus)
                .set("AssignedAgentUserId", agent)
                .set("UpdatedTimestamp", Instant.now());
        SupportRequestEntity updated = mongoTemplate.findAndModify(
                q,
                u,
                FindAndModifyOptions.options().returnNew(true),
                SupportRequestEntity.class
        );
        return Optional.ofNullable(updated);
    }

    private String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
