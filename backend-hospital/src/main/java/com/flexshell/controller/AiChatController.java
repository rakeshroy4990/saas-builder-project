package com.flexshell.controller;

import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.SmartAiQuotaExceededException;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.controller.dto.AiChatResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.observability.ObservabilityLogger;
import com.flexshell.service.AiChatService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/hospital/ai")
public class AiChatController {
    private static final Logger LOG = LoggerFactory.getLogger(AiChatController.class);
    private final AiChatService aiChatService;
    private final String accessTokenCookieName;

    public AiChatController(
            AiChatService aiChatService,
            @Value("${app.auth.cookie.access-token-name:access_token}") String accessTokenCookieName
    ) {
        this.aiChatService = aiChatService;
        this.accessTokenCookieName = accessTokenCookieName == null || accessTokenCookieName.isBlank()
                ? "access_token"
                : accessTokenCookieName.trim();
    }

    @PostMapping(value = "/chat", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AiChatResponse>> chat(
            @Valid @RequestBody AiChatRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        try {
            String userId = authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
            var userRoles = authentication == null
                    ? java.util.List.<String>of()
                    : authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            String authForRag = authorizationForRagProxy(authorizationHeader, httpRequest);
            AiChatResponse data = aiChatService.reply(userId, request, authForRag, userRoles);
            var successFields = new java.util.LinkedHashMap<>(ObservabilityLogger.fields("chat", "success", "reply_received"));
            successFields.put("user_id", userId);
            ObservabilityLogger.info(LOG, "chat_ai_request", successFields);
            return ResponseEntity.ok(StandardApiResponse.success("AI response", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "AI_CHAT_INVALID"));
        } catch (SmartAiQuotaExceededException ex) {
            HttpStatus status = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.BAD_REQUEST;
            String code = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                    ? "AI_SMART_QUOTA_DAILY"
                    : "AI_SMART_QUOTA_TOKEN";
            var quotaFields = new java.util.LinkedHashMap<>(ObservabilityLogger.fields(
                    "chat",
                    "fail",
                    ex.kind() == SmartAiQuotaExceededException.Kind.DAILY ? "quota_daily" : "quota_token"));
            ObservabilityLogger.warn(LOG, "chat_ai_request", quotaFields);
            return ResponseEntity.status(status)
                    .body(StandardApiResponse.error(ex.getMessage(), code));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "AI_CHAT_FORBIDDEN"));
        } catch (AiProviderException ex) {
            String baseCode = ex.kind() == AiProviderException.Kind.CONFIG_MISSING
                    ? "AI_CONFIG_MISSING"
                    : "AI_PROVIDER_FAILED";
            Integer providerHttpStatus = ex.providerHttpStatus();
            String code = providerHttpStatus == null ? baseCode : baseCode + "_HTTP_" + providerHttpStatus;
            HttpStatus status = (providerHttpStatus != null && providerHttpStatus == 429)
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.SERVICE_UNAVAILABLE;
            var providerFields = new java.util.LinkedHashMap<>(ObservabilityLogger.fields(
                    "chat",
                    "fail",
                    providerHttpStatus != null && providerHttpStatus == 429 ? "provider_429" : "provider_5xx"));
            providerFields.put("provider", ex.provider());
            providerFields.put("provider_http_status", providerHttpStatus);
            providerFields.put("provider_status", ex.providerStatus());
            ObservabilityLogger.warn(LOG, "chat_ai_request", providerFields);
            return ResponseEntity.status(status)
                    .body(StandardApiResponse.error(ex.getMessage(), code));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "AI_CHAT_UNAVAILABLE"));
        }
    }

    /**
     * Pdf-rag is called with an {@code Authorization} header. Browsers often send only the access JWT cookie
     * (same as {@link com.flexshell.auth.security.JwtAuthenticationFilter}); synthesize {@code Bearer ...} for the proxy.
     */
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
