package com.flexshell.audio;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;

@Service
public class LocalConsultationAudioStorage implements ConsultationAudioStorage {

    private final Path baseDir;
    private final String apiBaseUrl;

    public LocalConsultationAudioStorage(
            @Value("${app.ai.conversation.storage.local.base-dir:./data/consultation-audio}") String baseDir,
            @Value("${app.public.api-base-url:http://localhost:8080}") String apiBaseUrl
    ) {
        this.baseDir = Path.of(Objects.toString(baseDir, "./data/consultation-audio").trim()).toAbsolutePath().normalize();
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

    @Override
    public void upload(String storagePath, byte[] bytes, String mimeType) {
        Path target = resolveSafePath(storagePath);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
        } catch (IOException ex) {
            throw new IllegalStateException("Consultation audio storage write failed", ex);
        }
    }

    @Override
    public String createAccessUrl(String storagePath) {
        String key = normalizeKey(storagePath);
        String encoded = URLEncoder.encode(key, StandardCharsets.UTF_8);
        return apiBaseUrl + "/api/audio/storage-file?path=" + encoded;
    }

    @Override
    public Path resolveLocalPath(String storagePath) {
        return resolveSafePath(storagePath);
    }

    @Override
    public byte[] readBytes(String storagePath) {
        Path target = resolveSafePath(storagePath);
        try {
            return Files.readAllBytes(target);
        } catch (IOException ex) {
            throw new IllegalStateException("Consultation audio storage read failed", ex);
        }
    }

    private Path resolveSafePath(String storagePath) {
        String key = normalizeKey(storagePath);
        Path resolved = baseDir.resolve(key).normalize();
        if (!resolved.startsWith(baseDir)) {
            throw new SecurityException("Invalid storage path");
        }
        return resolved;
    }

    public static String normalizeKey(String storagePath) {
        String key = Objects.toString(storagePath, "").trim().replace('\\', '/');
        while (key.startsWith("/")) {
            key = key.substring(1);
        }
        if (key.isBlank() || key.contains("..")) {
            throw new SecurityException("Invalid storage path");
        }
        return key;
    }
}
