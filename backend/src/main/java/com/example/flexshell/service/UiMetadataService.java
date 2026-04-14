package com.example.flexshell.service;

import com.example.flexshell.uimetadata.UiMetadataPersistenceService;
import com.example.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.example.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Application service layer for UI metadata use-cases.
 * Controller -> this service -> persistence service -> repository.
 */
@Service
public class UiMetadataService {

    private final ObjectProvider<UiMetadataPersistenceService> persistenceServiceProvider;

    public UiMetadataService(ObjectProvider<UiMetadataPersistenceService> persistenceServiceProvider) {
        this.persistenceServiceProvider = persistenceServiceProvider;
    }

    public boolean isStorageAvailable() {
        return persistenceServiceProvider.getIfAvailable() != null;
    }

    public boolean save(UiMetadataSaveRequest body) throws JsonProcessingException {
        UiMetadataPersistenceService persistenceService = persistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) return false;
        persistenceService.saveDocument(body);
        return true;
    }

    public Optional<UiMetadataGetResponse> loadStored() throws JsonProcessingException {
        UiMetadataPersistenceService persistenceService = persistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) return Optional.empty();
        return persistenceService.loadDocument();
    }

    public boolean deleteStored() {
        UiMetadataPersistenceService persistenceService = persistenceServiceProvider.getIfAvailable();
        if (persistenceService == null) return false;
        persistenceService.deleteDocument();
        return true;
    }

    public UiMetadataGetResponse emptyResponse() {
        return new UiMetadataGetResponse();
    }
}
