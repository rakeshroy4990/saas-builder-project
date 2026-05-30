package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.ChatAckJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatAckJpaRepository extends JpaRepository<ChatAckJpaEntity, String> {

    Optional<ChatAckJpaEntity> findByRoomIdAndUserIdAndDeletedFalse(String roomId, String userId);
}
