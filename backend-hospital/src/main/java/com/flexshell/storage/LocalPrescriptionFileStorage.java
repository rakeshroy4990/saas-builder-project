package com.flexshell.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

/**
 * Dev-friendly storage when Supabase S3 credentials are not configured.
 * Files are written under {@code app.prescription.storage.local.base-dir}; downloads use
 * {@code GET /api/v1/patient-prescriptions/storage-file} (authenticated).
 */
@Service
public class LocalPrescriptionFileStorage implements PrescriptionFileStorage {

    private final Path baseDir;
    private final String apiBaseUrl;

    public LocalPrescriptionFileStorage(
            @Value("${app.prescription.storage.local.base-dir:./data/prescription-storage}") String baseDir,
            @Value("${app.public.api-base-url:http://localhost:8080}") String apiBaseUrl
    ) {
        this.baseDir = Path.of(Objects.toString(baseDir, "./data/prescription-storage").trim()).toAbsolutePath().normalize();
        String base = Objects.toString(apiBaseUrl, "http://localhost:8080").trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        this.apiBaseUrl = base;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    public Path baseDir() {
        return baseDir;
    }

    @Override
    public void upload(String storagePath, byte[] bytes, String mimeType) {
        Path target = resolveSafePath(storagePath);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        } catch (IOException ex) {
            throw new IllegalStateException("Local prescription storage write failed", ex);
        }
    }

    @Override
    public String createSignedUrl(String storagePath) {
        String key = S3PrescriptionFileStorage.normalizeKey(storagePath);
        String encoded = URLEncoder.encode(key, StandardCharsets.UTF_8);
        return apiBaseUrl + "/api/v1/patient-prescriptions/storage-file?path=" + encoded;
    }

    public Path resolveSafePath(String storagePath) {
        String key = S3PrescriptionFileStorage.normalizeKey(storagePath);
        Path resolved = baseDir.resolve(key).normalize();
        if (!resolved.startsWith(baseDir)) {
            throw new SecurityException("Invalid storage path");
        }
        return resolved;
    }
}
