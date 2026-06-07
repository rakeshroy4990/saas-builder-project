package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.SmartAiQuotaExceededException;
import com.flexshell.auth.security.AuthRequestAttributes;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.controller.dto.AiChatResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.observability.ObservabilityLogger;
import com.flexshell.service.AiChatService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/hospital/ai")
public class AiChatController {
    private final LocalizedApiMessages messages;

    private static final Logger LOG = LoggerFactory.getLogger(AiChatController.class);
    private static final MediaType NDJSON = MediaType.parseMediaType("application/x-ndjson");
    private final AiChatService aiChatService;
    private final String accessTokenCookieName;

    public AiChatController(
            AiChatService aiChatService,
            LocalizedApiMessages messages,
            @Value("${app.auth.cookie.access-token-name:access_token}") String accessTokenCookieName
    ) {
        this.aiChatService = aiChatService;
        this.messages = messages;
        this.accessTokenCookieName = accessTokenCookieName == null || accessTokenCookieName.isBlank()
                ? "access_token"
                : accessTokenCookieName.trim();
    }

    /**
     * JSON reply. Declared {@code produces} avoids overlap with the NDJSON stream mapping when
     * {@code Accept} is broad (for example {@code *}{@code /}*).
     */
    @PostMapping(value = "/chat", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AiChatResponse>> chatJson(
            @Valid @RequestBody AiChatRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        ChatContext ctx = chatContext(authorizationHeader, authentication, httpRequest);
        AiChatResponse data = aiChatService.reply(ctx.userId(), request, ctx.authForRag(), ctx.userRoles());
        var successFields = new LinkedHashMap<>(ObservabilityLogger.fields("chat", "success", "reply_received"));
        successFields.put("user_id", ctx.userId());
        ObservabilityLogger.info(LOG, "chat_ai_request", successFields);
        return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.ai.chat.response"), data));
    }

    /**
     * NDJSON stream. Must use {@link ResponseEntity}{@code <}{@link StreamingResponseBody}{@code >}} (not
     * {@code ResponseEntity<?>}) so {@link org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBodyReturnValueHandler}
     * applies; otherwise Spring tries an {@link org.springframework.http.converter.HttpMessageConverter} for the lambda body.
     */
    @PostMapping(
            value = "/chat",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = {"application/x-ndjson", "application/ndjson"}
    )
    public ResponseEntity<StreamingResponseBody> chatNdjson(
            @Valid @RequestBody AiChatRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorizationHeader,
            Authentication authentication,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse
    ) {
        httpResponse.setBufferSize(1024);
        httpResponse.setHeader("X-Accel-Buffering", "no");
        ChatContext ctx = chatContext(authorizationHeader, authentication, httpRequest);
        LOG.info(
                "hospital_ai_chat_request ndjson=true authenticated={} principal_blank={}",
                authentication != null && authentication.isAuthenticated(),
                authentication == null || authentication.getName() == null || authentication.getName().isBlank()
        );
        StreamingResponseBody body = aiChatService.streamReply(ctx.userId(), request, ctx.authForRag(), ctx.userRoles());
        var streamFields = new LinkedHashMap<>(ObservabilityLogger.fields("chat", "success", "stream_started"));
        streamFields.put("user_id", ctx.userId());
        ObservabilityLogger.info(LOG, "chat_ai_request", streamFields);
        return ResponseEntity.ok()
                .contentType(NDJSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
    }

    /**
     * Request validation / JSON parse errors on {@code /chat} can occur after the NDJSON mapping was selected
     * ({@code Accept: application/x-ndjson}). Without an explicit JSON {@code Content-Type}, Spring may keep the
     * NDJSON type and then fail with {@code HttpMessageNotWritableException} for a non-NDJSON body (e.g. map).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<StandardApiResponse<Void>> handleAiChatValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        if (msg.isBlank()) {
            msg = "Invalid request";
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body(StandardApiResponse.error(messages.forErrorCode("AI_CHAT_INVALID"), "AI_CHAT_INVALID"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<StandardApiResponse<Void>> handleAiChatUnreadable(HttpMessageNotReadableException ex) {
        String msg = ex.getMessage() == null || ex.getMessage().isBlank() ? "Invalid JSON body" : ex.getMessage();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body(StandardApiResponse.error(messages.forErrorCode("AI_CHAT_INVALID"), "AI_CHAT_INVALID"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<StandardApiResponse<Void>> handleAiChatIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .contentType(MediaType.APPLICATION_JSON)
                .body(StandardApiResponse.error(messages.resolveException(ex, "AI_CHAT_INVALID"), "AI_CHAT_INVALID"));
    }

    @ExceptionHandler(SmartAiQuotaExceededException.class)
    public ResponseEntity<StandardApiResponse<Void>> handleAiChatQuota(SmartAiQuotaExceededException ex) {
        HttpStatus status = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                ? HttpStatus.TOO_MANY_REQUESTS
                : HttpStatus.BAD_REQUEST;
        String code = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                ? "AI_SMART_QUOTA_DAILY"
                : "AI_SMART_QUOTA_TOKEN";
        var quotaFields = new LinkedHashMap<>(ObservabilityLogger.fields(
                "chat",
                "fail",
                ex.kind() == SmartAiQuotaExceededException.Kind.DAILY ? "quota_daily" : "quota_token"));
        ObservabilityLogger.warn(LOG, "chat_ai_request", quotaFields);
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(StandardApiResponse.error(messages.resolveException(ex, code), code));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<StandardApiResponse<Void>> handleAiChatSecurity(SecurityException ex) {
        LOG.warn("hospital_ai_chat_security_error code=AI_CHAT_FORBIDDEN message={}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .contentType(MediaType.APPLICATION_JSON)
                .body(StandardApiResponse.error(messages.resolveException(ex, "AI_CHAT_FORBIDDEN"), "AI_CHAT_FORBIDDEN"));
    }

    @ExceptionHandler(AiProviderException.class)
    public ResponseEntity<StandardApiResponse<Void>> handleAiChatProvider(AiProviderException ex) {
        String baseCode = ex.kind() == AiProviderException.Kind.CONFIG_MISSING
                ? "AI_CONFIG_MISSING"
                : "AI_PROVIDER_FAILED";
        Integer providerHttpStatus = ex.providerHttpStatus();
        String code = providerHttpStatus == null ? baseCode : baseCode + "_HTTP_" + providerHttpStatus;
        HttpStatus status = (providerHttpStatus != null && providerHttpStatus == 429)
                ? HttpStatus.TOO_MANY_REQUESTS
                : HttpStatus.SERVICE_UNAVAILABLE;
        var providerFields = new LinkedHashMap<>(ObservabilityLogger.fields(
                "chat",
                "fail",
                providerHttpStatus != null && providerHttpStatus == 429 ? "provider_429" : "provider_5xx"));
        providerFields.put("provider", ex.provider());
        providerFields.put("provider_http_status", providerHttpStatus);
        providerFields.put("provider_status", ex.providerStatus());
        ObservabilityLogger.warn(LOG, "chat_ai_request", providerFields);
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(StandardApiResponse.error(messages.resolveException(ex, code), code));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<StandardApiResponse<Void>> handleAiChatIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .contentType(MediaType.APPLICATION_JSON)
                .body(StandardApiResponse.error(messages.resolveException(ex, "AI_CHAT_UNAVAILABLE"), "AI_CHAT_UNAVAILABLE"));
    }

    private ChatContext chatContext(
            String authorizationHeader,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        String userId = authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
        List<String> userRoles = authentication == null
                ? List.of()
                : authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        String authForRag = authorizationForRagProxy(authorizationHeader, httpRequest);
        return new ChatContext(userId, userRoles, authForRag);
    }

    private record ChatContext(String userId, List<String> userRoles, String authForRag) {
    }

    /**
     * Pdf-rag is called with an {@code Authorization} header. Browsers often send only the access JWT cookie
     * (same as {@link com.flexshell.auth.security.JwtAuthenticationFilter}); synthesize {@code Bearer ...} for the proxy.
     */
    private String authorizationForRagProxy(
            String authorizationHeader,
            HttpServletRequest request
    ) {
        Object rawAttr = request.getAttribute(AuthRequestAttributes.RAW_ACCESS_TOKEN);
        if (rawAttr instanceof String s && !s.isBlank()) {
            return "Bearer " + s.trim();
        }
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
