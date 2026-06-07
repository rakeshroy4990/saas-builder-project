package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.controller.dto.PatientDeviceReadingCreateRequest;
import com.flexshell.controller.dto.PatientDeviceReadingResponse;
import com.flexshell.controller.dto.PatientDeviceReadingSaveRequest;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient-device-readings")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PatientDeviceReadingController {
    private final LocalizedApiMessages messages;


    private final PatientDeviceReadingService patientDeviceReadingService;

    public PatientDeviceReadingController(PatientDeviceReadingService patientDeviceReadingService,
            LocalizedApiMessages messages) {
        this.messages = messages;

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
                    .body(StandardApiResponse.success(messages.success("success.patient.device.reading.saved"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "PATIENT_DEVICE_READING_INVALID"), "PATIENT_DEVICE_READING_INVALID"));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<PatientDeviceReadingResponse>>> list(
            @PageableDefault(size = 20, sort = "recordedAt", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            Page<PatientDeviceReadingResponse> page = patientDeviceReadingService.listForActor(userId, pageable);
            return EntityListResponseSupport.ok(
                    messages.success("success.patient.device.reading.list"),
                    page.getContent(),
                    page.getNumber(),
                    page.getSize(),
                    page.getTotalElements());
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PatientDeviceReadingResponse>> save(
            @RequestBody PatientDeviceReadingSaveRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            PatientDeviceReadingResponse data = patientDeviceReadingService.save(userId, request);
            HttpStatus status = request.getExternalId() == null ? HttpStatus.CREATED : HttpStatus.OK;
            return ResponseEntity.status(status).body(StandardApiResponse.success(messages.success("success.patient.device.reading.saved"), data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "PATIENT_DEVICE_READING_INVALID"), "PATIENT_DEVICE_READING_INVALID"));
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
            patientDeviceReadingService.deleteByBusinessKey(userId, businessKey);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.patient.device.reading.deleted"), null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "PATIENT_DEVICE_READING_NOT_FOUND"), "PATIENT_DEVICE_READING_NOT_FOUND"));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private <T> ResponseEntity<StandardApiResponse<T>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
    }

    private <T> ResponseEntity<StandardApiResponse<T>> forbidden(String message) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(StandardApiResponse.error(
                        message.isBlank() ? messages.forErrorCode("PATIENT_DEVICE_READING_FORBIDDEN") : message,
                        "PATIENT_DEVICE_READING_FORBIDDEN"
                ));
    }
}
