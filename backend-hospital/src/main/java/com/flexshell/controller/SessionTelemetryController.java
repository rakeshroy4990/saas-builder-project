package com.flexshell.controller;

import com.flexshell.controller.dto.SessionTelemetryBatchRequest;
import com.flexshell.controller.dto.SessionTelemetryEventRequest;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.SessionTelemetryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/telemetry")
public class SessionTelemetryController {
    private final SessionTelemetryService sessionTelemetryService;

    public SessionTelemetryController(SessionTelemetryService sessionTelemetryService) {
        this.sessionTelemetryService = sessionTelemetryService;
    }

    @PostMapping(value = "/session-event", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Map<String, Object>>> ingestSessionEvent(
            @Valid @RequestBody SessionTelemetryEventRequest request,
            Authentication authentication
    ) {
        try {
            String actorUserId = authentication == null ? "" : authentication.getName();
            Map<String, Object> data = sessionTelemetryService.ingestSessionEvent(actorUserId, request);
            return ResponseEntity.ok(StandardApiResponse.success("Telemetry session updated", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "TELEMETRY_INVALID"));
        }
    }

    @PostMapping(value = "/session-events", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Map<String, Object>>> ingestSessionEvents(
            @Valid @RequestBody SessionTelemetryBatchRequest batch,
            Authentication authentication
    ) {
        try {
            String actorUserId = authentication == null ? "" : authentication.getName();
            Map<String, Object> data = sessionTelemetryService.ingestSessionEventBatch(actorUserId, batch.getEvents());
            return ResponseEntity.ok(StandardApiResponse.success("Telemetry batch applied", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "TELEMETRY_INVALID"));
        }
    }

    @GetMapping(value = "/session-snapshot", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Map<String, Object>>> getSessionSnapshot(
            @RequestParam("trace_id") String traceId
    ) {
        Map<String, Object> data = sessionTelemetryService.findSnapshotByTraceId(traceId);
        return ResponseEntity.ok(StandardApiResponse.success("Session snapshot", data));
    }
}
