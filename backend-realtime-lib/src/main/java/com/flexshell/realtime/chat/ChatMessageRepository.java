package com.flexshell.realtime.chat;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessageEntity, String> {
    List<ChatMessageEntity> findTop50ByRoomIdOrderBySequenceNumberDesc(String roomId);
}

