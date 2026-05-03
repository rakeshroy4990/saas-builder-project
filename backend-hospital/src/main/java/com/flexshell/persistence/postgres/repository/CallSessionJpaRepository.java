package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.CallSessionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CallSessionJpaRepository extends JpaRepository<CallSessionJpaEntity, String> {

    Optional<CallSessionJpaEntity> findByCallIdAndDeletedFalse(String callId);
}
