package com.flexshell.uimetadata;

import com.flexshell.logging.CommonLogger;
import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@ConditionalOnProperty(prefix = "app.mongo", name = "enabled", havingValue = "true")
public class UiMetadataPersistenceService {
    private static final Logger LOG = LoggerFactory.getLogger(UiMetadataPersistenceService.class);
    private static final CommonLogger COMMON_LOGGER = new CommonLogger(LOG);

    private final UiMetadataRepository repository;
    private final ObjectMapper objectMapper;

    public UiMetadataPersistenceService(UiMetadataRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public void saveDocument(UiMetadataSaveRequest body) throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("saveDocument", "id=default");
        UiMetadataEntity entity = new UiMetadataEntity();
        entity.setId(UiMetadataEntity.SINGLETON_ID);
        entity.setBodyJson(objectMapper.writeValueAsString(body));
        entity.setUpdatedAt(Instant.now());
        COMMON_LOGGER.serviceEntry("MongoDB", "repository.save", "id=" + entity.getId());
        repository.save(entity);
        COMMON_LOGGER.serviceExit("MongoDB", "repository.save", "id=" + entity.getId());
        LOG.info("ui-metadata persistence save completed, id={}", UiMetadataEntity.SINGLETON_ID);
        COMMON_LOGGER.methodExit("saveDocument", "result=ok");
    }

    public Optional<UiMetadataGetResponse> loadDocument() throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("loadDocument", "id=default");
        COMMON_LOGGER.serviceEntry("MongoDB", "repository.findById", "id=" + UiMetadataEntity.SINGLETON_ID);
        Optional<UiMetadataEntity> row = repository.findById(UiMetadataEntity.SINGLETON_ID);
        COMMON_LOGGER.serviceExit("MongoDB", "repository.findById", "found=" + row.isPresent());
        if (row.isEmpty()) {
            LOG.warn("ui-metadata persistence load found no document, id={}", UiMetadataEntity.SINGLETON_ID);
            COMMON_LOGGER.methodExit("loadDocument", "found=false");
            return Optional.empty();
        }
        UiMetadataGetResponse mapped = objectMapper.readValue(row.get().getBodyJson(), UiMetadataGetResponse.class);
        LOG.info("ui-metadata persistence load completed, id={}", UiMetadataEntity.SINGLETON_ID);
        COMMON_LOGGER.methodExit("loadDocument", "found=true");
        return Optional.of(mapped);
    }

    public void deleteDocument() {
        deleteDocumentById(UiMetadataEntity.SINGLETON_ID);
    }

    public void deleteDocumentById(String id) {
        COMMON_LOGGER.methodEntry("deleteDocumentById", "id=" + id);
        COMMON_LOGGER.serviceEntry("MongoDB", "repository.deleteById", "id=" + id);
        repository.deleteById(id);
        COMMON_LOGGER.serviceExit("MongoDB", "repository.deleteById", "id=" + id);
        LOG.info("ui-metadata persistence delete completed, id={}", id);
        COMMON_LOGGER.methodExit("deleteDocumentById", "result=ok");
    }
}
