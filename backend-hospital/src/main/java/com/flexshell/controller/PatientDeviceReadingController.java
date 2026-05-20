package com.flexshell.controller;

import com.flexshell.controller.dto.PatientDeviceReadingCreateRequest;
import com.flexshell.controller.dto.PatientDeviceReadingResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.PatientDeviceReadingService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping("/api/v1/patient-device-readings")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PatientDeviceReadingController {

    private final PatientDeviceReadingService patientDeviceReadingService;

    public PatientDeviceReadingController(PatientDeviceReadingService patientDeviceReadingService) {
        this.patientDeviceReadingService = patientDeviceReadingService;
    }

    @PostMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PatientDeviceReadingResponse>> create(
            @RequestBody PatientDeviceReadingCreateRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            PatientDeviceReadingResponse data = patientDeviceReadingService.create(userId, request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(StandardApiResponse.success("Device reading saved", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_DEVICE_READING_INVALID"));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Page<PatientDeviceReadingResponse>>> list(
            @PageableDefault(size = 20, sort = "recordedAt", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            Page<PatientDeviceReadingResponse> page = patientDeviceReadingService.listForActor(userId, pageable);
            return ResponseEntity.ok(StandardApiResponse.success("Device readings fetched", page));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private static <T> ResponseEntity<StandardApiResponse<T>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(StandardApiResponse.error("Authentication required.", "AUTH_REQUIRED"));
    }

    private static <T> ResponseEntity<StandardApiResponse<T>> forbidden(String message) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(StandardApiResponse.error(
                        message.isBlank() ? "Forbidden" : message,
                        "PATIENT_DEVICE_READING_FORBIDDEN"
                ));
    }
}
