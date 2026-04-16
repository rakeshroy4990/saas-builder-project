package com.flexshell.compliance;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface AuditEventRepository extends MongoRepository<AuditEventEntity, String> {
}

