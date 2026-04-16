package com.flexshell.realtime.webrtc;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface CallSessionRepository extends MongoRepository<CallSessionEntity, String> {
}

