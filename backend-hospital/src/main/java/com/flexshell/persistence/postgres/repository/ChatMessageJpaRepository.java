package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.ChatMessageJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatMessageJpaRepository extends JpaRepository<ChatMessageJpaEntity, String> {

    List<ChatMessageJpaEntity> findTop50ByRoomIdAndDeletedFalseOrderBySequenceNumberDesc(String roomId);

    Optional<ChatMessageJpaEntity> findByRoomIdAndClientMessageIdAndDeletedFalse(String roomId, String clientMessageId);
}
