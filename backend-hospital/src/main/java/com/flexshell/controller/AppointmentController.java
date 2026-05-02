package com.flexshell.controller;

import com.flexshell.controller.dto.AppointmentRequest;
import com.flexshell.controller.dto.AppointmentResponse;
import com.flexshell.controller.dto.AvailableSlotsResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.observability.ObservabilityLogger;
import com.flexshell.controller.dto.AppointmentJoinCallResponse;
import com.flexshell.controller.dto.AppointmentRenewTokenResponse;
import com.flexshell.service.AppointmentService;
import com.flexshell.video.AppointmentJoinCallService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/appointment")
public class AppointmentController {
    private static final Logger log = LoggerFactory.getLogger(AppointmentController.class);
    private final AppointmentService appointmentService;
    private final AppointmentJoinCallService appointmentJoinCallService;

    public AppointmentController(
            AppointmentService appointmentService,
            AppointmentJoinCallService appointmentJoinCallService
    ) {
        this.appointmentService = appointmentService;
        this.appointmentJoinCallService = appointmentJoinCallService;
    }

    /**
     * Secure Agora (or builtin) join: validates participant, appointment status, and slot window; returns server-minted token.
     * Channel name for Agora is the appointment id — do not use guessable strings.
     */
    @PostMapping(value = "/{id}/join-call", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentJoinCallResponse>> joinCall(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            AppointmentJoinCallResponse data = appointmentJoinCallService.joinCall(authentication.getName(), id);
            return ResponseEntity.ok(StandardApiResponse.success("Join call", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_JOIN_CALL_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_JOIN_CALL_INVALID"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_JOIN_CALL_CONFIG"));
        }
    }

    /**
     * Renews Agora RTC token before expiry; use from the client {@code token-privilege-will-expire} handler.
     */
    @PostMapping(value = "/{id}/renew-token", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentRenewTokenResponse>> renewToken(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            AppointmentRenewTokenResponse data = appointmentJoinCallService.renewToken(authentication.getName(), id);
            return ResponseEntity.ok(StandardApiResponse.success("Token renewed", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_RENEW_TOKEN_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_RENEW_TOKEN_INVALID"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_RENEW_TOKEN_CONFIG"));
        }
    }

    /** Ends the video call segment (audit / duration); does not complete the clinical visit. */
    @PostMapping(value = "/{id}/end-call", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> endCall(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            appointmentJoinCallService.endCall(authentication.getName(), id);
            return ResponseEntity.ok(StandardApiResponse.success("Call ended", null));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_END_CALL_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_END_CALL_INVALID"));
        }
    }

    @PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentResponse>> create(
            @RequestPart("appointment") AppointmentRequest request,
            @RequestPart(name = "prescriptions", required = false) List<MultipartFile> prescriptions,
            Authentication authentication
    ) {
        try {
            AppointmentResponse data = appointmentService.create(request, prescriptions, authentication.getName());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(StandardApiResponse.success("Appointment created", data));
        } catch (IllegalArgumentException ex) {
            ObservabilityLogger.warn(log, "appointment_create", java.util.Map.of(
                    "domain", "appointment",
                    "status", "fail",
                    "reason_code", "validation_error"));
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_CREATE_INVALID"));
        }
    }

    @PutMapping(value = "/update/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentResponse>> update(
            @PathVariable String id,
            @RequestPart("appointment") AppointmentRequest request,
            @RequestPart(name = "prescriptions", required = false) List<MultipartFile> prescriptions,
            Authentication authentication
    ) {
        try {
            AppointmentResponse data = appointmentService.update(id, request, prescriptions, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Appointment updated", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_UPDATE_INVALID"));
        }
    }

    @DeleteMapping(value = "/delete/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(@PathVariable String id, Authentication authentication) {
        try {
            appointmentService.delete(id, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Appointment deleted", null));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_DELETE_INVALID"));
        }
    }

    @PostMapping(value = "/cancel/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentResponse>> cancel(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            AppointmentResponse data = appointmentService.cancel(id, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Appointment cancelled", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_CANCEL_INVALID"));
        }
    }

    @PostMapping(value = "/complete/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentResponse>> completeVisit(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            AppointmentResponse data = appointmentService.completeVisit(id, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Visit marked complete", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_COMPLETE_INVALID"));
        }
    }

    @GetMapping(value = "/get/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentResponse>> getById(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            AppointmentResponse data = appointmentService.getById(id, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Appointment fetched", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_NOT_FOUND"));
        }
    }

    @GetMapping(value = "/get", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<AppointmentResponse>>> getAll(
            Authentication authentication,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        try {
            List<AppointmentResponse> data = appointmentService.getAll(authentication.getName(), page, size);
            return ResponseEntity.ok(StandardApiResponse.success("Appointments fetched", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        }
    }

    @GetMapping(value = "/available-slots", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AvailableSlotsResponse>> listAvailableTimeSlots(
            @RequestParam("doctorId") String doctorId,
            @RequestParam("date") String date,
            @RequestParam(name = "excludeAppointmentId", required = false) String excludeAppointmentId,
            Authentication authentication
    ) {
        try {
            AvailableSlotsResponse data = appointmentService.listAvailableTimeSlots(
                    doctorId,
                    date,
                    excludeAppointmentId,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Available time slots", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_AVAILABLE_SLOTS_INVALID"));
        }
    }

    /**
     * Book-an-appointment flow: doctor schedule for the date minus slots held by open appointments.
     */
    @GetMapping(value = "/booking/available-slots", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AvailableSlotsResponse>> listBookingAvailableTimeSlots(
            @RequestParam("doctorId") String doctorId,
            @RequestParam("date") String date,
            @RequestParam(name = "excludeAppointmentId", required = false) String excludeAppointmentId,
            Authentication authentication
    ) {
        try {
            AvailableSlotsResponse data = appointmentService.listBookingAvailableTimeSlots(
                    doctorId,
                    date,
                    excludeAppointmentId,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Booking available time slots", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_BOOKING_SLOTS_INVALID"));
        }
    }

    @GetMapping(value = "/occupied-slots", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<String>>> listOccupiedTimeSlots(
            @RequestParam("doctorId") String doctorId,
            @RequestParam("date") String date,
            @RequestParam(name = "excludeAppointmentId", required = false) String excludeAppointmentId,
            Authentication authentication
    ) {
        try {
            List<String> data = appointmentService.listOccupiedTimeSlots(
                    doctorId,
                    date,
                    excludeAppointmentId,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Occupied time slots", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_OCCUPIED_SLOTS_INVALID"));
        }
    }

    @GetMapping(value = "/file/{appointmentId}/{fileId}")
    public ResponseEntity<byte[]> getFile(
            @PathVariable String appointmentId,
            @PathVariable String fileId,
            Authentication authentication
    ) {
        try {
            AppointmentEntity.AppointmentFile file = appointmentService.getFile(appointmentId, fileId, authentication.getName());
            MediaType mediaType = file.getContentType() == null || file.getContentType().isBlank()
                    ? MediaType.APPLICATION_OCTET_STREAM
                    : MediaType.parseMediaType(file.getContentType());
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getFileName() + "\"")
                    .body(file.getData());
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
