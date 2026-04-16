package com.flexshell.service;

import com.flexshell.logging.CommonLogger;
import com.flexshell.uimetadata.UiMetadataPersistenceService;
import com.flexshell.uimetadata.api.UiMetadataFacade;
import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Application service layer for UI metadata use-cases.
 * Controller -> this service -> persistence service -> repository.
 */
@Service
public class UiMetadataService implements UiMetadataFacade {
    private static final Logger LOG = LoggerFactory.getLogger(UiMetadataService.class);
    private static final CommonLogger COMMON_LOGGER = new CommonLogger(LOG);

    private final ObjectProvider<UiMetadataPersistenceService> persistenceServiceProvider;

    public UiMetadataService(ObjectProvider<UiMetadataPersistenceService> persistenceServiceProvider) {
        this.persistenceServiceProvider = persistenceServiceProvider;
    }

    public boolean isStorageAvailable() {
        COMMON_LOGGER.methodEntry("isStorageAvailable", "check=true");
        boolean available = persistenceServiceProvider.getIfAvailable() != null;
        COMMON_LOGGER.methodExit("isStorageAvailable", "available=" + available);
        return available;
    }

    public boolean save(UiMetadataSaveRequest body) throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("save", "packageCount=" + (body.getPackages() == null ? 0 : body.getPackages().size()));
        UiMetadataPersistenceService persistenceService = persistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            LOG.warn("ui-metadata service save aborted persistenceUnavailable=true");
            COMMON_LOGGER.methodExit("save", "result=false");
            return false;
        }
        persistenceService.saveDocument(body);
        LOG.info("ui-metadata service save successful packageCount={}",
                body.getPackages() == null ? 0 : body.getPackages().size());
        COMMON_LOGGER.methodExit("save", "result=true");
        return true;
    }

    public Optional<UiMetadataGetResponse> loadStored() throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("loadStored", "read=default");
        UiMetadataPersistenceService persistenceService = persistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            LOG.warn("ui-metadata service load aborted persistenceUnavailable=true");
            COMMON_LOGGER.methodExit("loadStored", "result=empty");
            return Optional.empty();
        }
        Optional<UiMetadataGetResponse> result = persistenceService.loadDocument();
        LOG.info("ui-metadata service load completed found={} packageCount={}",
                result.isPresent(),
                result.map(r -> r.getPackages() == null ? 0 : r.getPackages().size()).orElse(0));
        COMMON_LOGGER.methodExit("loadStored", "found=" + result.isPresent());
        return result;
    }

    public boolean deleteStored() {
        return deleteStoredById(null);
    }

    public boolean deleteStoredById(String id) {
        COMMON_LOGGER.methodEntry("deleteStoredById", "requestedId=" + id);
        UiMetadataPersistenceService persistenceService = persistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) {
            LOG.warn("ui-metadata service delete aborted persistenceUnavailable=true requestedId={}", id);
            COMMON_LOGGER.methodExit("deleteStoredById", "result=false");
            return false;
        }
        String normalizedId = (id == null || id.isBlank()) ? "default" : id;
        persistenceService.deleteDocumentById(normalizedId);
        LOG.info("ui-metadata service delete successful id={}", normalizedId);
        COMMON_LOGGER.methodExit("deleteStoredById", "result=true normalizedId=" + normalizedId);
        return true;
    }

    public UiMetadataGetResponse emptyResponse() {
        return new UiMetadataGetResponse();
    }
}
