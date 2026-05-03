package com.flexshell.uimetadata;

import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;

import java.util.Optional;

/**
 * Loads and stores UI metadata overrides (Mongo or Postgres).
 */
public interface UiMetadataPersistencePort {

    void saveDocument(UiMetadataSaveRequest body) throws JsonProcessingException;

    Optional<UiMetadataGetResponse> loadDocument() throws JsonProcessingException;

    void deleteDocument();

    void deleteDocumentById(String id);
}
