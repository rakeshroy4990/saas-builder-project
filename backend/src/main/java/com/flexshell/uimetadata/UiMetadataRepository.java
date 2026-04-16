package com.flexshell.uimetadata;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface UiMetadataRepository extends MongoRepository<UiMetadataEntity, String> {
}
