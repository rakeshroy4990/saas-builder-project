package com.example.flexshell.uimetadata;

import com.example.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.example.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@ConditionalOnProperty(prefix = "spring.data.mongodb", name = "uri")
public class UiMetadataPersistenceService {

    private final UiMetadataRepository repository;
    private final ObjectMapper objectMapper;

    public UiMetadataPersistenceService(UiMetadataRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public void saveDocument(UiMetadataSaveRequest body) throws JsonProcessingException {
        UiMetadataEntity entity = new UiMetadataEntity();
        entity.setId(UiMetadataEntity.SINGLETON_ID);
        entity.setBodyJson(objectMapper.writeValueAsString(body));
        entity.setUpdatedAt(Instant.now());
        repository.save(entity);
    }

    public Optional<UiMetadataGetResponse> loadDocument() throws JsonProcessingException {
        Optional<UiMetadataEntity> row = repository.findById(UiMetadataEntity.SINGLETON_ID);
        if (row.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(objectMapper.readValue(row.get().getBodyJson(), UiMetadataGetResponse.class));
    }

    public void deleteDocument() {
        repository.deleteById(UiMetadataEntity.SINGLETON_ID);
    }
}
