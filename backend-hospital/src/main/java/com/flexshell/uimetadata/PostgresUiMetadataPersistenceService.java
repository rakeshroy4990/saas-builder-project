package com.flexshell.uimetadata;

import com.flexshell.logging.CommonLogger;
import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.persistence.postgres.model.UiMetadataJpaEntity;
import com.flexshell.persistence.postgres.repository.UiMetadataJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@Primary
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PostgresUiMetadataPersistenceService implements UiMetadataPersistencePort {
    private static final Logger LOG = LoggerFactory.getLogger(PostgresUiMetadataPersistenceService.class);
    private static final CommonLogger COMMON_LOGGER = new CommonLogger(LOG);

    private final UiMetadataJpaRepository repository;
    private final ObjectMapper objectMapper;

    public PostgresUiMetadataPersistenceService(UiMetadataJpaRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void saveDocument(UiMetadataSaveRequest body) throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("saveDocument", "id=default");
        UiMetadataJpaEntity row = repository.findByIdAndDeletedFalse(UiMetadataEntity.SINGLETON_ID).orElseGet(UiMetadataJpaEntity::new);
        row.setId(UiMetadataEntity.SINGLETON_ID);
        row.setBodyJson(objectMapper.writeValueAsString(body));
        row.setUpdatedAt(Instant.now());
        row.setDeleted(false);
        COMMON_LOGGER.serviceEntry("PostgreSQL", "repository.save", "id=" + row.getId());
        repository.save(row);
        COMMON_LOGGER.serviceExit("PostgreSQL", "repository.save", "id=" + row.getId());
        LOG.info("ui-metadata persistence save completed, id={}", UiMetadataEntity.SINGLETON_ID);
        COMMON_LOGGER.methodExit("saveDocument", "result=ok");
    }

    @Override
    public Optional<UiMetadataGetResponse> loadDocument() throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("loadDocument", "id=default");
        COMMON_LOGGER.serviceEntry("PostgreSQL", "repository.findById", "id=" + UiMetadataEntity.SINGLETON_ID);
        Optional<UiMetadataJpaEntity> row = repository.findByIdAndDeletedFalse(UiMetadataEntity.SINGLETON_ID);
        COMMON_LOGGER.serviceExit("PostgreSQL", "repository.findById", "found=" + row.isPresent());
        if (row.isEmpty()) {
            LOG.warn("ui-metadata persistence load found no row, id={}", UiMetadataEntity.SINGLETON_ID);
            COMMON_LOGGER.methodExit("loadDocument", "found=false");
            return Optional.empty();
        }
        String json = row.get().getBodyJson();
        if (json == null || json.isBlank()) {
            COMMON_LOGGER.methodExit("loadDocument", "found=false");
            return Optional.empty();
        }
        UiMetadataGetResponse mapped = objectMapper.readValue(json, UiMetadataGetResponse.class);
        LOG.info("ui-metadata persistence load completed, id={}", UiMetadataEntity.SINGLETON_ID);
        COMMON_LOGGER.methodExit("loadDocument", "found=true");
        return Optional.of(mapped);
    }

    @Override
    public void deleteDocument() {
        deleteDocumentById(UiMetadataEntity.SINGLETON_ID);
    }

    @Override
    public void deleteDocumentById(String id) {
        COMMON_LOGGER.methodEntry("deleteDocumentById", "id=" + id);
        String normalized = (id == null || id.isBlank()) ? UiMetadataEntity.SINGLETON_ID : id;
        COMMON_LOGGER.serviceEntry("PostgreSQL", "repository.softDelete", "id=" + normalized);
        repository.findByIdAndDeletedFalse(normalized).ifPresent(row -> {
            row.setDeleted(true);
            row.setBodyJson(null);
            row.setUpdatedAt(Instant.now());
            repository.save(row);
        });
        COMMON_LOGGER.serviceExit("PostgreSQL", "repository.softDelete", "id=" + normalized);
        LOG.info("ui-metadata persistence delete completed, id={}", normalized);
        COMMON_LOGGER.methodExit("deleteDocumentById", "result=ok");
    }
}
