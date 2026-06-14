package com.flexshell.controller.v1;

import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.TriageAnalyzeRequest;
import com.flexshell.controller.dto.TriageResultResponse;
import com.flexshell.controller.dto.TriageResultSaveRequest;
import com.flexshell.controller.dto.PagedTriageResultListDto;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.RagProxyAuthorizationSupport;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.TriageResultService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/triage-results")
public class TriageResultV1Controller {

    private static final Logger LOG = LoggerFactory.getLogger(TriageResultV1Controller.class);
    private static final MediaType NDJSON = MediaType.parseMediaType("application/x-ndjson");

    private final TriageResultService triageResultService;
    private final LocalizedApiMessages messages;
    private final String accessTokenCookieName;

    public TriageResultV1Controller(
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
            return unauthorized();
        }
        try {
            String authorization = RagProxyAuthorizationSupport.resolveBearerAuthorization(
                    servletRequest,
                    accessTokenCookieName
            );
            if (authorization == null || authorization.isBlank()) {
                return unauthorized();
            }
            TriageResultResponse data = triageResultService.analyze(
                    userId,
                    request,
                    authorization
            );
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.triage.result.analyzed"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "TRIAGE_RESULT_INVALID"), code(ex)));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @PostMapping(
            value = "/analyze",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = {"application/x-ndjson", "application/ndjson"}
    )
    public ResponseEntity<StreamingResponseBody> analyzeNdjson(
            @RequestBody TriageAnalyzeRequest request,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String acceptHeader,
            Authentication authentication,
            HttpServletRequest servletRequest,
            HttpServletResponse httpResponse
    ) {
        LOG.info(
                "triage_analyze_ndjson_request accept={} authenticated={} principal={}",
                acceptHeader,
                authentication != null && authentication.isAuthenticated(),
                authentication == null ? "" : Objects.toString(authentication.getName(), "").trim()
        );
        return analyzeStreamResponse(request, authentication, servletRequest, httpResponse);
    }

    @PostMapping(
            value = "/analyze/stream",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = {"application/x-ndjson", "application/ndjson"}
    )
    public ResponseEntity<StreamingResponseBody> analyzeStream(
            @RequestBody TriageAnalyzeRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest,
            HttpServletResponse httpResponse
    ) {
        return analyzeStreamResponse(request, authentication, servletRequest, httpResponse);
    }

    private ResponseEntity<StreamingResponseBody> analyzeStreamResponse(
            TriageAnalyzeRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest,
            HttpServletResponse httpResponse
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String authorization = RagProxyAuthorizationSupport.resolveBearerAuthorization(
                servletRequest,
                accessTokenCookieName
        );
        if (authorization == null || authorization.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            httpResponse.setBufferSize(512);
            httpResponse.setHeader("X-Accel-Buffering", "no");
            httpResponse.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            StreamingResponseBody body = triageResultService.streamAnalyze(userId, request, authorization);
            LOG.info("triage_analyze_ndjson_stream_started actorId={}", userId);
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

    @GetMapping(value = "/appointment-id/{appointmentId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<TriageResultResponse>> getForAppointmentId(
            @PathVariable String appointmentId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            TriageResultResponse data = triageResultService.getForAppointmentBusinessId(userId, appointmentId);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.triage.result.loaded"), data));
        } catch (IllegalArgumentException ex) {
            HttpStatus status = "APPOINTMENT_NOT_FOUND".equals(code(ex)) ? HttpStatus.NOT_FOUND : HttpStatus.NOT_FOUND;
            return ResponseEntity.status(status)
                    .body(StandardApiResponse.error(messages.resolveException(ex, code(ex)), code(ex)));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @GetMapping(value = "/appointment/{appointmentExternalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<TriageResultResponse>> getForAppointment(
            @PathVariable UUID appointmentExternalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            TriageResultResponse data = triageResultService.getForAppointment(userId, appointmentExternalId);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.triage.result.loaded"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "TRIAGE_RESULT_NOT_FOUND"), code(ex)));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<TriageResultResponse>> save(
            @RequestBody TriageResultSaveRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            TriageResultResponse data = triageResultService.save(userId, request);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.triage.result.linked"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "TRIAGE_RESULT_INVALID"), code(ex)));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<TriageResultResponse>>> list(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            PagedTriageResultListDto paged = triageResultService.listForPatient(userId, page, size);
            return EntityListResponseSupport.ok(
                    messages.success("success.triage.result.list"),
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(
            @PathVariable UUID businessKey,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            triageResultService.deleteByBusinessKey(userId, businessKey);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.triage.result.deleted"), null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "TRIAGE_RESULT_NOT_FOUND"), code(ex)));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private static String code(IllegalArgumentException ex) {
        String message = ex.getMessage();
        return message == null || message.isBlank() ? "TRIAGE_RESULT_INVALID" : message.trim();
    }

    private <T> ResponseEntity<StandardApiResponse<T>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
    }

    private <T> ResponseEntity<StandardApiResponse<T>> forbidden(String message) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(StandardApiResponse.error(
                        message.isBlank() ? messages.forErrorCode("TRIAGE_RESULT_FORBIDDEN") : message,
                        "TRIAGE_RESULT_FORBIDDEN"
                ));
    }
}
