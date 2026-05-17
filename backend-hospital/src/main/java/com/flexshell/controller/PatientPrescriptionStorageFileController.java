package com.flexshell.controller;

import com.flexshell.auth.UserRole;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import com.flexshell.storage.LocalPrescriptionFileStorage;
import com.flexshell.storage.PrescriptionStorageKeys;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Objects;

/**
 * Serves files stored by {@link LocalPrescriptionFileStorage} when S3 is not configured.
 */
@RestController
@RequestMapping("/api/v1/patient-prescriptions")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
@ConditionalOnBean(LocalPrescriptionFileStorage.class)
public class PatientPrescriptionStorageFileController {

    private final LocalPrescriptionFileStorage localStorage;
    private final UserJpaRepository userRepository;

    public PatientPrescriptionStorageFileController(
            LocalPrescriptionFileStorage localStorage,
            UserJpaRepository userRepository
    ) {
        this.localStorage = localStorage;
        this.userRepository = userRepository;
    }

    @GetMapping("/storage-file")
    public ResponseEntity<Resource> storageFile(
            @RequestParam("path") String storagePath,
            Authentication authentication
    ) {
        String actorUserId = authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
        if (actorUserId.isBlank()) {
            return ResponseEntity.status(401).build();
        }
        if (!canReadPath(actorUserId, storagePath)) {
            return ResponseEntity.status(403).build();
        }
        Path file = localStorage.resolveSafePath(storagePath);
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        String contentType = probeContentType(file);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .contentType(MediaType.parseMediaType(contentType))
                .body(new FileSystemResource(file));
    }

    private boolean canReadPath(String actorUserId, String storagePath) {
        UserRole role = userRepository.findById(actorUserId)
                .map(UserJpaEntity::getRole)
                .orElse(UserRole.PATIENT);
        return PrescriptionStorageKeys.canActorRead(actorUserId, role, storagePath);
    }

    private static String probeContentType(Path file) {
        try {
            String probed = Files.probeContentType(file);
            if (probed != null && !probed.isBlank()) {
                return probed;
            }
        } catch (Exception ignored) {
            // fall through
        }
        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".pdf")) {
            return "application/pdf";
        }
        if (name.endsWith(".png")) {
            return "image/png";
        }
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        return "application/octet-stream";
    }
}
