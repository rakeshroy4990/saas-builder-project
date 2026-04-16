package com.flexshell.realtime.chat;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ChatRoomRepository extends MongoRepository<ChatRoomEntity, String> {
    List<ChatRoomEntity> findByParticipantsContaining(String userId);
}

