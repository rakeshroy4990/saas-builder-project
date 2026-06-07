package com.flexshell.controller.v1;

import com.flexshell.i18n.LocalizedApiMessages;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.DoctorScheduleQueryDto;
import com.flexshell.controller.dto.DoctorScheduleResponse;
import com.flexshell.controller.dto.DoctorScheduleUpsertRequest;
import com.flexshell.controller.dto.PagedDoctorScheduleListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.service.DoctorScheduleService;
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
@RequestMapping("/api/v1/doctor-schedules")
public class DoctorScheduleV1Controller {
    private final LocalizedApiMessages messages;


    private static final Set<String> QUERY_KEYS = Set.of("DoctorId");

    private final DoctorScheduleService doctorScheduleService;
    private final ObjectMapper objectMapper;

    public DoctorScheduleV1Controller(DoctorScheduleService doctorScheduleService, ObjectMapper objectMapper,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.doctorScheduleService = doctorScheduleService;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DoctorScheduleResponse>>> list(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "Query", required = false) String queryJson,
            @ModelAttribute DoctorScheduleQueryDto query,
            Authentication authentication
    ) {
        try {
            EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedDoctorScheduleListDto paged = doctorScheduleService.listPaged(
                    authentication.getName(),
                    page,
                    size,
                    query
            );
            return EntityListResponseSupport.ok(
                    messages.success("success.doctor.schedule.list"),
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_FORBIDDEN"), "DOCTOR_SCHEDULE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_LIST_INVALID"), "DOCTOR_SCHEDULE_LIST_INVALID"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<DoctorScheduleResponse>> save(
            @RequestBody DoctorScheduleUpsertRequest request,
            Authentication authentication
    ) {
        try {
            DoctorScheduleResponse data = doctorScheduleService.upsert(request, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.schedule.saved"), data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_FORBIDDEN"), "DOCTOR_SCHEDULE_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_SCHEDULE_SAVE_INVALID"), "DOCTOR_SCHEDULE_SAVE_INVALID"));
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
