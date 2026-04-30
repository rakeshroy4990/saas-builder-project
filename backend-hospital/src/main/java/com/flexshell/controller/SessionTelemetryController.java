package com.flexshell.controller;

import com.flexshell.controller.dto.SessionTelemetryEventRequest;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.SessionTelemetryService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
        String actorUserId = authentication == null ? "" : String(authentication.getName());
        Map<String, Object> data = sessionTelemetryService.ingestSessionEvent(actorUserId, request);
        return ResponseEntity.ok(StandardApiResponse.success("Telemetry session updated", data));
    }
}
