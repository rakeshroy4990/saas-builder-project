package com.flexshell.uimetadata.controller;

import com.flexshell.uimetadata.api.UiMetadataFacade;
import com.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * Reusable REST API to persist UI metadata.
 * Endpoint contract is stable across backend services.
 */
@RestController
@RequestMapping("/api/uiMetdata")
public class UiMetadataController {
    private static final Logger LOG = LoggerFactory.getLogger(UiMetadataController.class);

    private final UiMetadataFacade uiMetadataFacade;

    public UiMetadataController(UiMetadataFacade uiMetadataFacade) {
        this.uiMetadataFacade = uiMetadataFacade;
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> save(@Valid @RequestBody UiMetadataSaveRequest body) throws JsonProcessingException {
        LOG.info("ui-metadata save request received packageCount={} staticKeys={} dynamicKeys={} i18nLocales={}",
                body.getPackages() == null ? 0 : body.getPackages().size(),
                body.getStaticConfig() == null ? 0 : body.getStaticConfig().size(),
                body.getDynamicConfig() == null ? 0 : body.getDynamicConfig().size(),
                body.getI18nBundles() == null ? 0 : body.getI18nBundles().size());
        if (!uiMetadataFacade.save(body)) {
            LOG.warn("ui-metadata save skipped storageUnavailable=true");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        LOG.info("ui-metadata save completed status=201");
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UiMetadataGetResponse> load(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) throws JsonProcessingException {
        LOG.info("ui-metadata load request received");
        if (!uiMetadataFacade.isStorageAvailable()) {
            LOG.warn("ui-metadata load usingEmptyResponse storageUnavailable=true");
            return ResponseEntity.ok(uiMetadataFacade.emptyResponse());
        }
        Optional<UiMetadataGetResponse> doc = uiMetadataFacade.loadStored();
        if (doc.isPresent()) {
            UiMetadataGetResponse body = doc.get();
            LOG.info("ui-metadata load completed documentFound=true packageCount={} i18nLocales={}",
                    body.getPackages() == null ? 0 : body.getPackages().size(),
                    body.getI18nBundles() == null ? 0 : body.getI18nBundles().size());
            return ResponseEntity.ok(body);
        }
        LOG.warn("ui-metadata load completed documentFound=false");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    /**
     * Soft-deletes the singleton UI metadata row ({@code id=default}).
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteDefault() {
        return delete(UiMetadataFacade.DEFAULT_DOCUMENT_ID);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") String id) {
        LOG.info("ui-metadata delete request received id={}", id);
        if (!uiMetadataFacade.deleteStoredById(id)) {
            LOG.warn("ui-metadata delete skipped storageUnavailable=true id={}", id);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        LOG.info("ui-metadata delete completed id={} status=204", id);
        return ResponseEntity.noContent().build();
    }
}

