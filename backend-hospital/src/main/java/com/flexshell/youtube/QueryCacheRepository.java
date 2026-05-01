package com.flexshell.youtube;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface QueryCacheRepository extends MongoRepository<QueryCacheEntity, String> {
    Optional<QueryCacheEntity> findByUserIdAndQuery(String userId, String query);

    Page<QueryCacheEntity> findByUserIdOrderByUpdatedAtDesc(String userId, Pageable pageable);
}
