package com.example.flexshell.controller;

import com.example.flexshell.logging.api.ClientLogBatchRequest;
import com.example.flexshell.logging.api.LogIngestResponse;
import com.example.flexshell.logging.api.LogLevelChangeRequest;
import com.example.flexshell.logging.api.LogLevelResponse;
import com.example.flexshell.service.LogService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/logs")
@CrossOrigin(origins = "*")
public class LogController {
    private final LogService logService;

    public LogController(LogService logService) {
        this.logService = logService;
    }

    @PostMapping(value = "/batch", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LogIngestResponse> ingest(@Valid @RequestBody ClientLogBatchRequest request) {
        int accepted = logService.ingestClientLogs(request);
        return ResponseEntity.ok(new LogIngestResponse(accepted));
    }

    @PostMapping(value = "/level", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LogLevelResponse> changeLevel(@Valid @RequestBody LogLevelChangeRequest request) {
        String newLevel = logService.setServerLogLevel(request.getLevel());
        return ResponseEntity.ok(new LogLevelResponse(newLevel));
    }
}
