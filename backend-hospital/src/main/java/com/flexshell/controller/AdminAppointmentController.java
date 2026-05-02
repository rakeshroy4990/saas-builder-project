package com.flexshell.controller;

import com.flexshell.controller.dto.PagedAppointmentListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.AppointmentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.flexshell.controller.dto.AppointmentResponse;

@RestController
@RequestMapping("/api/admin/appointments")
public class AdminAppointmentController {
    private final AppointmentService appointmentService;

    public AdminAppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PagedAppointmentListDto>> listAll(
            Authentication authentication,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        try {
            PagedAppointmentListDto data = appointmentService.listAllAppointmentsPagedForAdmin(authentication.getName(), page, size);
            return ResponseEntity.ok(StandardApiResponse.success("Appointments loaded", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_ADMIN_FORBIDDEN"));
        }
    }

    @PostMapping(value = "/{id}/soft-delete", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AppointmentResponse>> softDelete(
            @PathVariable String id,
            Authentication authentication
    ) {
        try {
            AppointmentResponse data = appointmentService.softDeleteAppointmentAsAdmin(id, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Appointment marked deleted", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_ADMIN_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "APPOINTMENT_SOFT_DELETE_INVALID"));
        }
    }
}
