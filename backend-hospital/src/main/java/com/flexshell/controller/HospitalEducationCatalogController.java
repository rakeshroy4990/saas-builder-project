package com.flexshell.controller;

import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.PdfRagQueryAdapter;
import com.flexshell.ai.RagEducationCatalogModels.BooksPayload;
import com.flexshell.ai.RagEducationCatalogModels.KeyTopicsPayload;
import com.flexshell.controller.dto.StandardApiResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping("/api/hospital/education")
public class HospitalEducationCatalogController {
    private static final Logger LOG = LoggerFactory.getLogger(HospitalEducationCatalogController.class);
    private final PdfRagQueryAdapter pdfRagQueryAdapter;
    private final String accessTokenCookieName;

    public HospitalEducationCatalogController(
            PdfRagQueryAdapter pdfRagQueryAdapter,
            @Value("${app.auth.cookie.access-token-name:access_token}") String accessTokenCookieName
    ) {
        this.pdfRagQueryAdapter = pdfRagQueryAdapter;
        this.accessTokenCookieName = accessTokenCookieName == null || accessTokenCookieName.isBlank()
                ? "access_token"
                : accessTokenCookieName.trim();
    }

    @GetMapping(value = "/books", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<BooksPayload>> books(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestParam(name = "IncludeOutdated", defaultValue = "false") boolean includeOutdated,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (!isClinicalCatalogUser(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error("Education catalog is restricted to clinical users.", "EDUCATION_FORBIDDEN"));
        }
        try {
            String authForRag = authorizationForRagProxy(authorizationHeader, httpRequest);
            BooksPayload payload = pdfRagQueryAdapter.fetchEducationBooks(authForRag, includeOutdated);
            return ResponseEntity.ok(StandardApiResponse.success("Education books", payload));
        } catch (SecurityException ex) {
            LOG.warn("education_books_missing_auth");
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "EDUCATION_AUTH_MISSING"));
        } catch (AiProviderException ex) {
            LOG.warn("education_books_provider_failed kind={} msg={}", ex.kind(), ex.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "EDUCATION_CATALOG_UNAVAILABLE"));
        }
    }

    @GetMapping(value = "/key-topics", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<KeyTopicsPayload>> keyTopics(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            @RequestParam(name = "BookName", required = false) String bookName,
            @RequestParam(name = "Limit", defaultValue = "5") int limit,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (!isClinicalCatalogUser(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error("Education catalog is restricted to clinical users.", "EDUCATION_FORBIDDEN"));
        }
        try {
            String authForRag = authorizationForRagProxy(authorizationHeader, httpRequest);
            KeyTopicsPayload payload = pdfRagQueryAdapter.fetchEducationKeyTopics(authForRag, bookName, limit);
            return ResponseEntity.ok(StandardApiResponse.success("Education key topics", payload));
        } catch (SecurityException ex) {
            LOG.warn("education_key_topics_missing_auth");
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "EDUCATION_AUTH_MISSING"));
        } catch (AiProviderException ex) {
            LOG.warn("education_key_topics_provider_failed kind={} msg={}", ex.kind(), ex.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "EDUCATION_CATALOG_UNAVAILABLE"));
        }
    }

    private boolean isClinicalCatalogUser(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(Objects::nonNull)
                .anyMatch(a -> {
                    String u = a.toUpperCase();
                    return u.contains("DOCTOR") || u.contains("CLINICIAN") || u.contains("ADMIN");
                });
    }

    private String authorizationForRagProxy(String authorizationHeader, HttpServletRequest request) {
        if (authorizationHeader != null && !authorizationHeader.isBlank()) {
            return authorizationHeader.trim();
        }
        String fromCookie = readAccessTokenCookie(request, accessTokenCookieName);
        if (fromCookie == null || fromCookie.isBlank()) {
            return null;
        }
        return "Bearer " + fromCookie.trim();
    }

    private static String readAccessTokenCookie(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie c : cookies) {
            if (cookieName.equals(c.getName())) {
                return c.getValue();
            }
        }
        return null;
    }
}
