package com.example.flexshell.uimetadata;

import com.example.flexshell.service.UiMetadataService;
import com.example.flexshell.uimetadata.api.UiMetadataGetResponse;
import com.example.flexshell.uimetadata.api.UiMetadataSaveRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
@RequestMapping("/api/ui-metadata")
@CrossOrigin(origins = "*")
public class UiMetadataController {

    private final UiMetadataService uiMetadataService;

    public UiMetadataController(UiMetadataService uiMetadataService) {
        this.uiMetadataService = uiMetadataService;
    }

    /** Saves (upserts) the singleton UI metadata document. */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Void> save(@Valid @RequestBody UiMetadataSaveRequest body) throws JsonProcessingException {
        if (!uiMetadataService.save(body)) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /** Returns the stored document, or 404 if none. */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UiMetadataGetResponse> load() throws JsonProcessingException {
        if (!uiMetadataService.isStorageAvailable()) {
            return ResponseEntity.ok(uiMetadataService.emptyResponse());
        }
        Optional<UiMetadataGetResponse> doc = uiMetadataService.loadStored();
        if (doc.isPresent()) {
            return ResponseEntity.ok(doc.get());
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    /** Deletes stored singleton document (idempotent). */
    @DeleteMapping
    public ResponseEntity<Void> delete() {
        if (!uiMetadataService.deleteStored()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        return ResponseEntity.noContent().build();
    }
}
