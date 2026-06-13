package com.flexshell.controller;

import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.TriageAnalyzeRequest;
import com.flexshell.controller.dto.TriageResultResponse;
import com.flexshell.controller.support.RagProxyAuthorizationSupport;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.TriageResultService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

/**
 * Legacy alias for {@code POST /api/v1/triage-results/analyze}.
 */
@RestController
@RequestMapping("/api/triage")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class TriageLegacyController {

    private final TriageResultService triageResultService;
    private final LocalizedApiMessages messages;
    private final String accessTokenCookieName;

    public TriageLegacyController(
            TriageResultService triageResultService,
            LocalizedApiMessages messages,
            @Value("${app.auth.cookie.access-token-name:access_token}") String accessTokenCookieName
    ) {
        this.triageResultService = triageResultService;
        this.messages = messages;
        this.accessTokenCookieName = accessTokenCookieName;
    }

    @PostMapping(value = "/analyze", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<TriageResultResponse>> analyze(
            @RequestBody TriageAnalyzeRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            String authorization = RagProxyAuthorizationSupport.resolveBearerAuthorization(
                    servletRequest,
                    accessTokenCookieName
            );
            if (authorization == null || authorization.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
            }
            TriageResultResponse data = triageResultService.analyze(
                    userId,
                    request,
                    authorization
            );
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.triage.result.analyzed"), data));
        } catch (IllegalArgumentException ex) {
            String code = ex.getMessage() == null || ex.getMessage().isBlank() ? "TRIAGE_RESULT_INVALID" : ex.getMessage().trim();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "TRIAGE_RESULT_INVALID"), code));
        } catch (SecurityException ex) {
            String message = ex.getMessage() == null || ex.getMessage().isBlank()
                    ? messages.forErrorCode("TRIAGE_RESULT_FORBIDDEN")
                    : ex.getMessage();
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(message, "TRIAGE_RESULT_FORBIDDEN"));
        }
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }
}
