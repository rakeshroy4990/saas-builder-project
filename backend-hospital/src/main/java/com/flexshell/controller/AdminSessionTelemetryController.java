package com.flexshell.controller;

import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.SessionTelemetryService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/session-telemetry")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSessionTelemetryController {

    private final SessionTelemetryService sessionTelemetryService;
    private final LocalizedApiMessages messages;

    public AdminSessionTelemetryController(
            SessionTelemetryService sessionTelemetryService,
            LocalizedApiMessages messages
    ) {
        this.sessionTelemetryService = sessionTelemetryService;
        this.messages = messages;
    }

    /**
     * Search {@code session_telemetry} rows that recorded a client crash
     * ({@code flow=crash}, {@code app_crash} event, or summary {@code kind=crash}).
     */
    @GetMapping(value = "/crashes", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<Map<String, Object>>>> listCrashes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        SessionTelemetryService.CrashSnapshotPage paged = sessionTelemetryService.listCrashSnapshots(page, size);
        return EntityListResponseSupport.ok(
                messages.success("success.telemetry.crashes.list"),
                paged.items(),
                paged.page(),
                paged.size(),
                paged.totalElements()
        );
    }

    /**
     * Search {@code session_telemetry} rows whose derived {@code sessionFlow} includes at least one error
     * (HTTP 4xx/5xx, {@code api_error}, or {@code crash} summary rows).
     */
    @GetMapping(value = "/flow-errors", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<Map<String, Object>>>> listFlowErrors(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        SessionTelemetryService.CrashSnapshotPage paged = sessionTelemetryService.listFlowErrorSnapshots(page, size);
        return EntityListResponseSupport.ok(
                messages.success("success.telemetry.flow_errors.list"),
                paged.items(),
                paged.page(),
                paged.size(),
                paged.totalElements()
        );
    }
}
