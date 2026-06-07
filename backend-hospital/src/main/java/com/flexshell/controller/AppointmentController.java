package com.flexshell.controller;

import com.flexshell.controller.dto.AppointmentBookingFormContextResponse;
import com.flexshell.controller.dto.AppointmentQueryDto;
import com.flexshell.controller.dto.AppointmentRequest;
import com.flexshell.controller.dto.AppointmentResponse;
import com.flexshell.controller.dto.AppointmentSaveRequest;
import com.flexshell.controller.dto.AvailableSlotsResponse;
import com.flexshell.controller.dto.BookingDateAvailabilityResponse;
import com.flexshell.controller.dto.DoctorOptionResponse;
import com.flexshell.controller.dto.PagedAppointmentListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.auth.i18n.RequestLocaleAttributes;
import com.flexshell.service.DoctorDirectoryService;
import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.observability.ObservabilityLogger;
import com.flexshell.controller.dto.AppointmentJoinCallResponse;
import com.flexshell.controller.dto.AppointmentRenewTokenResponse;
import com.flexshell.service.AppointmentService;
import com.flexshell.video.AppointmentJoinCallService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
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

import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

@RestController
@RequestMapping("/api/appointment")
public class AppointmentController {
    private static final Logger log = LoggerFactory.getLogger(AppointmentController.class);
    private final AppointmentService appointmentService;
    private final AppointmentJoinCallService appointmentJoinCallService;
    private final ObjectProvider<DoctorDirectoryService> doctorDirectoryServiceProvider;

    public AppointmentController(
            AppointmentService appointmentService,
            AppointmentJoinCallService appointmentJoinCallService,
            ObjectProvider<DoctorDirectoryService> doctorDirectoryServiceProvider
    ) {
        this.appointmentService = appointmentService;
        this.appointmentJoinCallService = appointmentJoinCallService;
        this.doctorDirectoryServiceProvider = doctorDirectoryServiceProvider;
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

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentResponse>> save(
            @RequestBody AppointmentSaveRequest request,
            Authentication authentication
    ) {
        try {
            AppointmentResponse data = appointmentService.saveOrUpdate(request, authentication.getName());
            HttpStatus status = request.getId() == null || request.getId().isBlank()
                    ? HttpStatus.CREATED
                    : HttpStatus.OK;
            return ResponseEntity.status(status).body(StandardApiResponse.success("Appointment saved", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_SAVE_INVALID"));
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

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> deleteByBusinessKey(
            @PathVariable String businessKey,
            Authentication authentication
    ) {
        try {
            appointmentService.delete(businessKey, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Appointment deleted", null));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_NOT_FOUND"));
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
            PagedAppointmentListDto paged = appointmentService.listPaged(authentication.getName(), page, size, new AppointmentQueryDto());
            return EntityListResponseSupport.ok(
                    "Appointments fetched",
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
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

    /**
     * Booking calendar: slot counts for a doctor across a lookahead window (replaces N per-day slot calls).
     */
    @GetMapping(value = "/booking/date-availability", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<BookingDateAvailabilityResponse>> listBookingDateAvailability(
            @RequestParam("doctorId") String doctorId,
            @RequestParam(name = "lookaheadDays", defaultValue = "10") int lookaheadDays,
            @RequestParam(name = "excludeAppointmentId", required = false) String excludeAppointmentId,
            Authentication authentication
    ) {
        try {
            BookingDateAvailabilityResponse data = appointmentService.listBookingDateAvailability(
                    doctorId,
                    lookaheadDays,
                    excludeAppointmentId,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Booking date availability", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_BOOKING_DATE_AVAILABILITY_INVALID"));
        }
    }

    /**
     * Book-an-appointment form bootstrap: department doctors plus date availability in one request.
     */
    @GetMapping(value = "/booking/form-context", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentBookingFormContextResponse>> getBookingFormContext(
            @RequestParam(name = "department", required = false) String department,
            @RequestParam(name = "doctorId", required = false) String doctorId,
            @RequestParam(name = "lookaheadDays", defaultValue = "10") int lookaheadDays,
            @RequestParam(name = "excludeAppointmentId", required = false) String excludeAppointmentId,
            Authentication authentication,
            HttpServletRequest servletRequest
    ) {
        try {
            AppointmentBookingFormContextResponse data = new AppointmentBookingFormContextResponse();
            String dept = department == null ? "" : department.trim();
            if (!dept.isBlank()) {
                DoctorDirectoryService doctorDirectoryService = doctorDirectoryServiceProvider.getIfAvailable();
                if (doctorDirectoryService == null) {
                    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                            .body(StandardApiResponse.error(
                                    "Doctor directory service is unavailable",
                                    "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
                }
                String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
                List<DoctorOptionResponse> doctors = doctorDirectoryService.getDoctorsByDepartment(dept, 0, 100, locale);
                data.setDoctors(doctors);
            }
            String docId = doctorId == null ? "" : doctorId.trim();
            if (!docId.isBlank()) {
                data.setDateAvailability(appointmentService.listBookingDateAvailability(
                        docId,
                        lookaheadDays,
                        excludeAppointmentId,
                        authentication.getName()));
            }
            return ResponseEntity.ok(StandardApiResponse.success("Appointment booking form context", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_BOOKING_FORM_CONTEXT_INVALID"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
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
