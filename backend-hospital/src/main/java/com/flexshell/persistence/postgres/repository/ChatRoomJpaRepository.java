package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.ChatRoomJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ChatRoomJpaRepository extends JpaRepository<ChatRoomJpaEntity, String> {

    Optional<ChatRoomJpaEntity> findByIdAndDeletedFalse(String id);

    @Query(value = """
            SELECT * FROM chat_rooms
            WHERE deleted = false AND :userId = ANY(participants)
            """, nativeQuery = true)
    List<ChatRoomJpaEntity> findByParticipant(@Param("userId") String userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ChatRoomJpaEntity r
            SET r.nextSequence = r.nextSequence + 1,
                r.updatedAt = :updatedAt
            WHERE r.id = :roomId AND r.deleted = false
            """)
    int incrementNextSequence(@Param("roomId") String roomId, @Param("updatedAt") Instant updatedAt);
}
