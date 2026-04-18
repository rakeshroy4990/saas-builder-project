package com.flexshell.controller;

import com.flexshell.controller.dto.DoctorScheduleResponse;
import com.flexshell.controller.dto.DoctorScheduleUpsertRequest;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.DoctorScheduleService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/schedule")
public class DoctorScheduleController {
    private final DoctorScheduleService doctorScheduleService;

    public DoctorScheduleController(DoctorScheduleService doctorScheduleService) {
        this.doctorScheduleService = doctorScheduleService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DoctorScheduleResponse>> get(
            @RequestParam("doctorId") String doctorId,
            Authentication authentication
    ) {
        try {
            return doctorScheduleService.getSchedule(doctorId, authentication.getName())
                    .map(body -> ResponseEntity.ok(StandardApiResponse.success("Doctor schedule", body)))
                    .orElseGet(() -> ResponseEntity.ok(StandardApiResponse.success("No schedule saved yet",
                            doctorScheduleService.emptyShellForDoctor(doctorId))));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOCTOR_SCHEDULE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOCTOR_SCHEDULE_INVALID"));
        }
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DoctorScheduleResponse>> put(
            @RequestBody DoctorScheduleUpsertRequest request,
            Authentication authentication
    ) {
        try {
            DoctorScheduleResponse saved = doctorScheduleService.upsert(request, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Doctor schedule saved", saved));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOCTOR_SCHEDULE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOCTOR_SCHEDULE_INVALID"));
        }
    }
}
