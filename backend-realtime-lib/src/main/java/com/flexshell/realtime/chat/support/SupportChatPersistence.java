package com.flexshell.realtime.chat.support;

import java.util.List;
import java.util.Optional;

/**
 * Storage for human support chat requests (Mongo or Postgres, depending on deployment).
 */
public interface SupportChatPersistence {

    SupportRequestEntity save(SupportRequestEntity request);

    Optional<SupportRequestEntity> claimOpenRequest(String requestId, String agentUserId);

    Optional<SupportRequestEntity> closeOpenRequest(String requestId, String agentUserId);

    List<SupportRequestEntity> listOpenRequests(int limit);

    Optional<SupportRequestEntity> findRequestById(String requestId);
}
