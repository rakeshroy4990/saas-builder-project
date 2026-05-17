package com.flexshell.storage;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Supabase Storage REST client (service role). Paths stored in DB, not public URLs.
 */
@Service
@ConditionalOnProperty(name = "app.prescription.storage.provider", havingValue = "supabase")
public class SupabaseStorageService implements PrescriptionFileStorage {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String supabaseUrl;
    private final String serviceKey;
    private final String bucket;
    private final int signedUrlTtlSeconds;
    private final boolean enabled;

    public SupabaseStorageService(
            ObjectMapper objectMapper,
            @Value("${app.supabase.url:}") String supabaseUrl,
            @Value("${app.supabase.service-key:}") String serviceKey,
            @Value("${app.supabase.storage-bucket:prescription}") String bucket,
            @Value("${app.supabase.signed-url-ttl-seconds:900}") int signedUrlTtlSeconds
    ) {
        this.objectMapper = objectMapper;
        this.supabaseUrl = normalizeBaseUrl(supabaseUrl);
        this.serviceKey = Objects.toString(serviceKey, "").trim();
        this.bucket = Objects.toString(bucket, S3PrescriptionFileStorage.DEFAULT_PRESCRIPTION_BUCKET).trim();
        this.signedUrlTtlSeconds = Math.max(60, Math.min(3600, signedUrlTtlSeconds));
        this.enabled = !this.supabaseUrl.isBlank() && !this.serviceKey.isBlank();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public void upload(String storagePath, byte[] bytes, String mimeType) {
        requireEnabled();
        String encodedPath = encodeObjectPath(storagePath);
        String url = supabaseUrl + "/storage/v1/object/" + bucket + "/" + encodedPath;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60))
                    .header("Authorization", "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .header("Content-Type", mimeType == null || mimeType.isBlank() ? "application/octet-stream" : mimeType)
                    .header("x-upsert", "false")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(bytes))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Storage upload failed with HTTP " + response.statusCode());
            }
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Storage upload failed", ex);
        }
    }

    @Override
    public String createSignedUrl(String storagePath) {
        requireEnabled();
        String encodedPath = encodeObjectPath(storagePath);
        String url = supabaseUrl + "/storage/v1/object/sign/" + bucket + "/" + encodedPath;
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("expiresIn", signedUrlTtlSeconds);
            String json = objectMapper.writeValueAsString(body);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Signed URL failed with HTTP " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            String signed = root.path("signedURL").asText("");
            if (signed.isBlank()) {
                signed = root.path("signedUrl").asText("");
            }
            if (signed.isBlank()) {
                throw new IllegalStateException("Signed URL missing in response");
            }
            if (signed.startsWith("/")) {
                return supabaseUrl + "/storage/v1" + signed;
            }
            return signed;
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Signed URL failed", ex);
        }
    }

    private void requireEnabled() {
        if (!enabled) {
            throw new IllegalStateException("Supabase storage is not configured");
        }
    }

    private static String normalizeBaseUrl(String raw) {
        String base = Objects.toString(raw, "").trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base;
    }

    private static String encodeObjectPath(String path) {
        String normalized = Objects.toString(path, "").trim().replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        String[] parts = normalized.split("/");
        StringBuilder encoded = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                encoded.append('/');
            }
            encoded.append(URLEncoder.encode(parts[i], StandardCharsets.UTF_8).replace("+", "%20"));
        }
        return encoded.toString();
    }
}
