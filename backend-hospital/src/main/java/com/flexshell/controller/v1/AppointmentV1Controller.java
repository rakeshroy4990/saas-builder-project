package com.flexshell.controller.v1;

import com.flexshell.i18n.LocalizedApiMessages;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AppointmentQueryDto;
import com.flexshell.controller.dto.AppointmentResponse;
import com.flexshell.controller.dto.AppointmentSaveRequest;
import com.flexshell.controller.dto.PagedAppointmentListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.service.AppointmentService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/appointments")
public class AppointmentV1Controller {
    private final LocalizedApiMessages messages;


    private static final Set<String> QUERY_KEYS = Set.of(
            "DoctorId", "Status", "PreferredDate", "PatientName", "Department", "UpcomingOnly"
    );

    private final AppointmentService appointmentService;
    private final ObjectMapper objectMapper;

    public AppointmentV1Controller(AppointmentService appointmentService, ObjectMapper objectMapper,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.appointmentService = appointmentService;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<AppointmentResponse>>> list(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "Query", required = false) String queryJson,
            @ModelAttribute AppointmentQueryDto query,
            Authentication authentication
    ) {
        try {
            EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedAppointmentListDto paged = appointmentService.listPaged(authentication.getName(), page, size, query);
            return EntityListResponseSupport.ok(
                    messages.success("success.appointment.list"),
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "APPOINTMENT_FORBIDDEN"), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "APPOINTMENT_LIST_INVALID"), "APPOINTMENT_LIST_INVALID"));
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
            return ResponseEntity.status(status).body(StandardApiResponse.success(messages.success("success.appointment.saved"), data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "APPOINTMENT_FORBIDDEN"), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "APPOINTMENT_SAVE_INVALID"), "APPOINTMENT_SAVE_INVALID"));
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(
            @PathVariable String businessKey,
            Authentication authentication
    ) {
        try {
            appointmentService.delete(businessKey, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.appointment.deleted"), null));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "APPOINTMENT_FORBIDDEN"), "APPOINTMENT_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "APPOINTMENT_NOT_FOUND"), "APPOINTMENT_NOT_FOUND"));
        }
    }
}
