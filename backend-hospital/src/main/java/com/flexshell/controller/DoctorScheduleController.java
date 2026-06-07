package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.controller.dto.DoctorScheduleResponse;
import com.flexshell.controller.dto.DoctorScheduleUpsertRequest;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.DoctorScheduleService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctor/schedule")
public class DoctorScheduleController {
    private final LocalizedApiMessages messages;

    private final DoctorScheduleService doctorScheduleService;

    public DoctorScheduleController(DoctorScheduleService doctorScheduleService,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.doctorScheduleService = doctorScheduleService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DoctorScheduleResponse>> get(
            @RequestParam("doctorId") String doctorId,
            Authentication authentication
    ) {
        try {
            return doctorScheduleService.getSchedule(doctorId, authentication.getName())
                    .map(body -> ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.schedule.fetched"), body)))
                    .orElseGet(() -> ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.schedule.empty"),
                            doctorScheduleService.emptyShellForDoctor(doctorId))));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_FORBIDDEN"), "DOCTOR_SCHEDULE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_INVALID"), "DOCTOR_SCHEDULE_INVALID"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DoctorScheduleResponse>> save(
            @RequestBody DoctorScheduleUpsertRequest request,
            Authentication authentication
    ) {
        return put(request, authentication);
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DoctorScheduleResponse>> put(
            @RequestBody DoctorScheduleUpsertRequest request,
            Authentication authentication
    ) {
        try {
            DoctorScheduleResponse saved = doctorScheduleService.upsert(request, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.schedule.saved"), saved));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_FORBIDDEN"), "DOCTOR_SCHEDULE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_INVALID"), "DOCTOR_SCHEDULE_INVALID"));
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(
            @PathVariable String businessKey,
            Authentication authentication
    ) {
        try {
            if (!doctorScheduleService.deleteByBusinessKey(businessKey, authentication.getName())) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(StandardApiResponse.error(messages.forErrorCode("DOCTOR_SCHEDULE_NOT_FOUND"), "DOCTOR_SCHEDULE_NOT_FOUND"));
            }
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.schedule.deleted"), null));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_FORBIDDEN"), "DOCTOR_SCHEDULE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_DELETE_INVALID"), "DOCTOR_SCHEDULE_DELETE_INVALID"));
        }
    }
}
