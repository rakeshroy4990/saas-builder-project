package com.flexshell.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class PdfRagPrescriptionValidationAdapter {
    private static final Logger LOG = LoggerFactory.getLogger(PdfRagPrescriptionValidationAdapter.class);

    private final boolean enabled;
    private final String baseUrl;
    private final String validatePath;
    private final String recommendedDosagePath;
    private final int timeoutSeconds;
    private final ObjectMapper objectMapper;

    public PdfRagPrescriptionValidationAdapter(
            @Value("${app.ai.rag.enabled:true}") boolean enabled,
            @Value("${app.ai.rag.base-url:http://localhost:8090}") String baseUrl,
            @Value("${app.ai.rag.prescription-validation-path:/api/v1/prescriptions/validate}") String validatePath,
            @Value("${app.ai.rag.prescription-recommended-dosage-path:/api/v1/prescriptions/recommended-dosage}") String recommendedDosagePath,
            @Value("${app.ai.rag.prescription-validation-timeout-seconds:30}") int timeoutSeconds,
            ObjectMapper objectMapper
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl == null ? "" : baseUrl.trim();
        this.validatePath = normalizeApiPath(validatePath == null ? "/api/v1/prescriptions/validate" : validatePath.trim());
        this.recommendedDosagePath = normalizeApiPath(
                recommendedDosagePath == null ? "/api/v1/prescriptions/recommended-dosage" : recommendedDosagePath.trim()
        );
        this.timeoutSeconds = Math.max(5, timeoutSeconds);
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> validate(
            List<Map<String, Object>> medications,
            List<String> activeDrugNames,
            Double childAgeMonths,
            Double childWeightKg,
            String weightSource,
            String authorizationHeader
    ) {
        if (!enabled || baseUrl.isBlank()) {
            throw new IllegalStateException("PRESCRIPTION_VALIDATION_NOT_CONFIGURED");
        }
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for prescription validation");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("Medications", medications);
        body.put("ActiveDrugNames", activeDrugNames == null ? List.of() : activeDrugNames);
        if (childAgeMonths != null) {
            body.put("ChildAgeMonths", childAgeMonths);
        }
        if (childWeightKg != null) {
            body.put("ChildWeightKg", childWeightKg);
        }
        body.put("WeightSource", Objects.toString(weightSource, "not_available"));

        RestClient client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(buildRestRequestFactory())
                .build();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(validatePath)
                    .headers(h -> h.set(HttpHeaders.AUTHORIZATION, authorizationHeader.trim()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            return response == null ? Map.of() : response;
        } catch (RestClientResponseException ex) {
            LOG.warn(
                    "pdf_rag_prescription_validation_failed status={} detail={}",
                    ex.getStatusCode().value(),
                    ex.getStatusText()
            );
            throw new IllegalStateException("PRESCRIPTION_VALIDATION_SERVICE_FAILED");
        } catch (Exception ex) {
            LOG.warn("pdf_rag_prescription_validation_failed message={}", ex.toString());
            throw new IllegalStateException("PRESCRIPTION_VALIDATION_SERVICE_FAILED");
        }
    }

    public Map<String, Object> recommendDosage(
            String drugName,
            Double childAgeMonths,
            Double childWeightKg,
            String route,
            String authorizationHeader
    ) {
        if (!enabled || baseUrl.isBlank()) {
            throw new IllegalStateException("PRESCRIPTION_VALIDATION_NOT_CONFIGURED");
        }
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw new SecurityException("Missing authorization header for recommended dosage");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("DrugName", drugName);
        body.put("ChildAgeMonths", childAgeMonths);
        if (childWeightKg != null) {
            body.put("ChildWeightKg", childWeightKg);
        }
        body.put("Route", route == null || route.isBlank() ? "oral" : route);

        RestClient client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(buildRestRequestFactory())
                .build();
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = client.post()
                    .uri(recommendedDosagePath)
                    .headers(h -> h.set(HttpHeaders.AUTHORIZATION, authorizationHeader.trim()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            return response == null ? Map.of() : response;
        } catch (RestClientResponseException ex) {
            LOG.warn(
                    "pdf_rag_recommended_dosage_failed status={} detail={}",
                    ex.getStatusCode().value(),
                    ex.getStatusText()
            );
            throw new IllegalStateException("RECOMMENDED_DOSAGE_SERVICE_FAILED");
        } catch (Exception ex) {
            LOG.warn("pdf_rag_recommended_dosage_failed message={}", ex.toString());
            throw new IllegalStateException("RECOMMENDED_DOSAGE_SERVICE_FAILED");
        }
    }

    private static String normalizeApiPath(String path) {
        if (path.isBlank()) {
            return "/api/v1/prescriptions/validate";
        }
        return path.startsWith("/") ? path : "/" + path;
    }

    private SimpleClientHttpRequestFactory buildRestRequestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMs = (int) Duration.ofSeconds(timeoutSeconds).toMillis();
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return factory;
    }
}
