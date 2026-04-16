package com.flexshell.controller;

import com.flexshell.logging.CommonLogger;
import com.flexshell.service.UiMetadataService;
import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * REST API to persist UI metadata in MongoDB ({@code uiMetdata} collection). Beans are absent
 * when {@code spring.data.mongodb.uri} is not configured.
 */
@RestController
@RequestMapping("/api/uiMetdata")
@CrossOrigin(origins = "*")
public class UiMetadataController {
    private static final Logger LOG = LoggerFactory.getLogger(UiMetadataController.class);
    private static final CommonLogger COMMON_LOGGER = new CommonLogger(LOG);

    private final UiMetadataService uiMetadataService;

    public UiMetadataController(UiMetadataService uiMetadataService) {
        this.uiMetadataService = uiMetadataService;
    }

    /** Saves (upserts) the singleton UI metadata document. */
    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> save(@Valid @RequestBody UiMetadataSaveRequest body) throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("save", "endpoint=/api/uiMetdata/save");
        LOG.info("ui-metadata save request received packageCount={}",
                body.getPackages() == null ? 0 : body.getPackages().size());
        if (!uiMetadataService.save(body)) {
            LOG.warn("ui-metadata save skipped storageUnavailable=true");
            COMMON_LOGGER.methodExit("save", "status=503");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        LOG.info("ui-metadata save completed status=201");
        COMMON_LOGGER.methodExit("save", "status=201");
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /** Returns the stored document, or 404 if none. */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UiMetadataGetResponse> load() throws JsonProcessingException {
        COMMON_LOGGER.methodEntry("load", "endpoint=/api/uiMetdata");
        LOG.info("ui-metadata load request received");
        if (!uiMetadataService.isStorageAvailable()) {
            LOG.warn("ui-metadata load usingEmptyResponse storageUnavailable=true");
            COMMON_LOGGER.methodExit("load", "status=200 emptyResponse=true");
            return ResponseEntity.ok(uiMetadataService.emptyResponse());
        }
        Optional<UiMetadataGetResponse> doc = uiMetadataService.loadStored();
        if (doc.isPresent()) {
            LOG.info("ui-metadata load completed documentFound=true packageCount={}",
                    doc.get().getPackages() == null ? 0 : doc.get().getPackages().size());
            COMMON_LOGGER.methodExit("load", "status=200 documentFound=true");
            return ResponseEntity.ok(doc.get());
        }
        LOG.warn("ui-metadata load completed documentFound=false");
        COMMON_LOGGER.methodExit("load", "status=404 documentFound=false");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    /** Deletes stored metadata document by id (idempotent). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") String id) {
        COMMON_LOGGER.methodEntry("delete", "endpoint=/api/uiMetdata/{id}");
        LOG.info("ui-metadata delete request received id={}", id);
        if (!uiMetadataService.deleteStoredById(id)) {
            LOG.warn("ui-metadata delete skipped storageUnavailable=true id={}", id);
            COMMON_LOGGER.methodExit("delete", "status=503");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        LOG.info("ui-metadata delete completed id={} status=204", id);
        COMMON_LOGGER.methodExit("delete", "status=204");
        return ResponseEntity.noContent().build();
    }
}
