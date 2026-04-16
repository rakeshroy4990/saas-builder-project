package com.flexshell.realtime.chat.support;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SupportRequestRepository extends MongoRepository<SupportRequestEntity, String> {
    List<SupportRequestEntity> findTop20ByStatusOrderByCreatedTimestampDesc(SupportRequestStatus status);
}

