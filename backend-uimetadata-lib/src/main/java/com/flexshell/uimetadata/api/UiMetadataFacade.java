package com.flexshell.uimetadata.api;

import com.fasterxml.jackson.core.JsonProcessingException;

import java.util.Optional;

/**
 * Reusable facade contract for UI metadata endpoints.
 * Service implementations in each backend can plug in their own persistence logic.
 */
public interface UiMetadataFacade {

    String DEFAULT_DOCUMENT_ID = "default";

    boolean isStorageAvailable();

    boolean save(UiMetadataSaveRequest body) throws JsonProcessingException;

    Optional<UiMetadataGetResponse> loadStored() throws JsonProcessingException;

    boolean deleteStoredById(String id);

    UiMetadataGetResponse emptyResponse();
}

