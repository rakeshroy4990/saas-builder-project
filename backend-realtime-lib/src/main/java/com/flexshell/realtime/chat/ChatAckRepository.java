package com.flexshell.realtime.chat;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ChatAckRepository extends MongoRepository<ChatAckEntity, String> {
    Optional<ChatAckEntity> findByRoomIdAndUserId(String roomId, String userId);
}

