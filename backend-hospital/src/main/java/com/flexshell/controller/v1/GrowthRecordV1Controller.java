package com.flexshell.controller.v1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.GrowthHistorySummaryRequest;
import com.flexshell.controller.dto.GrowthHistorySummaryResponse;
import com.flexshell.controller.dto.GrowthRecordQueryDto;
import com.flexshell.controller.dto.GrowthRecordResponse;
import com.flexshell.controller.dto.GrowthRecordSaveRequest;
import com.flexshell.controller.dto.PagedGrowthRecordListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.controller.support.RagProxyAuthorizationSupport;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.GrowthRecordService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/growth-records")
public class GrowthRecordV1Controller {

    private static final MediaType NDJSON = MediaType.parseMediaType("application/x-ndjson");

    private static final Set<String> QUERY_KEYS = Set.of("ChildProfileExternalId");

    private final GrowthRecordService growthRecordService;
    private final LocalizedApiMessages messages;
    private final ObjectMapper objectMapper;
    private final String accessTokenCookieName;

    public GrowthRecordV1Controller(
            GrowthRecordService growthRecordService,
            LocalizedApiMessages messages,
            ObjectMapper objectMapper,
            @Value("${app.auth.cookie.access-token-name:access_token}") String accessTokenCookieName
    ) {
        this.growthRecordService = growthRecordService;
        this.messages = messages;
        this.objectMapper = objectMapper;
        this.accessTokenCookieName = accessTokenCookieName;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<GrowthRecordResponse>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @ModelAttribute GrowthRecordQueryDto query,
            @RequestParam(value = "Query", required = false) String queryJson,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            GrowthRecordQueryDto bound = EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedGrowthRecordListDto paged = growthRecordService.listForActor(userId, page, size, bound);
            return EntityListResponseSupport.ok(
                    messages.success("success.growth.record.list"),
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements()
            );
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<GrowthRecordResponse>> save(
            @RequestBody GrowthRecordSaveRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            GrowthRecordResponse data = growthRecordService.save(userId, request);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.growth.record.saved"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    @PostMapping(value = "/history-summary", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<GrowthHistorySummaryResponse>> historySummary(
            @RequestBody GrowthHistorySummaryRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            if (request.getReplyLocale() == null || request.getReplyLocale().isBlank()) {
                request.setReplyLocale(normalizeLocale(acceptLanguage));
            }
            String authorization = RagProxyAuthorizationSupport.resolveBearerAuthorization(
                    servletRequest,
                    accessTokenCookieName
            );
            if (authorization == null || authorization.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
            }
            GrowthHistorySummaryResponse data = growthRecordService.summarizeHistory(userId, request, authorization);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.growth.history.summary"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    @PostMapping(
            value = "/history-summary/stream",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = {"application/x-ndjson", "application/ndjson"}
    )
    public ResponseEntity<StreamingResponseBody> historySummaryStream(
            @RequestBody GrowthHistorySummaryRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest,
            HttpServletResponse httpResponse,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            if (request.getReplyLocale() == null || request.getReplyLocale().isBlank()) {
                request.setReplyLocale(normalizeLocale(acceptLanguage));
            }
            String authorization = RagProxyAuthorizationSupport.resolveBearerAuthorization(
                    servletRequest,
                    accessTokenCookieName
            );
            if (authorization == null || authorization.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            httpResponse.setBufferSize(512);
            httpResponse.setHeader("X-Accel-Buffering", "no");
            httpResponse.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            StreamingResponseBody body = growthRecordService.streamSummarizeHistory(userId, request, authorization);
            return ResponseEntity.ok()
                    .contentType(NDJSON)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(body);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    private static String normalizeLocale(String acceptLanguage) {
        String raw = Objects.toString(acceptLanguage, "en").trim().toLowerCase();
        if (raw.isBlank()) {
            return "en";
        }
        int comma = raw.indexOf(',');
        if (comma > 0) {
            raw = raw.substring(0, comma).trim();
        }
        int dash = raw.indexOf('-');
        return dash > 0 ? raw.substring(0, dash) : raw;
    }

    @DeleteMapping(value = "/{externalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(
            @PathVariable UUID externalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        try {
            growthRecordService.deleteByBusinessKey(userId, externalId);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.growth.record.deleted"), null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, ex.getMessage()), ex.getMessage()));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "FORBIDDEN"));
        }
    }

    private static String actorId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return "";
        }
        return Objects.toString(authentication.getName(), "").trim();
    }
}
