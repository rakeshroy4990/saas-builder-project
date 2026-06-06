package com.flexshell.persistence.postgres.repository;

import com.flexshell.persistence.postgres.model.DomainActionEventJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DomainActionEventJpaRepository extends JpaRepository<DomainActionEventJpaEntity, Long> {

    List<DomainActionEventJpaEntity> findByEnabledTrueAndDeletedFalseOrderByHttpMethodAscEndpointPatternAsc();

    List<DomainActionEventJpaEntity> findByDeletedFalseOrderByHttpMethodAscEndpointPatternAsc();

    Optional<DomainActionEventJpaEntity> findByExternalIdAndDeletedFalse(UUID externalId);

    Optional<DomainActionEventJpaEntity> findByHttpMethodIgnoreCaseAndEndpointPatternIgnoreCaseAndDeletedFalse(
            String httpMethod,
            String endpointPattern
    );
}
