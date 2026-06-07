package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import com.flexshell.controller.dto.DoctorAdminRow;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.AdminDoctorManagementService;
import com.flexshell.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/doctors")
public class AdminDoctorManagementController {
    private final LocalizedApiMessages messages;

    private final AdminDoctorManagementService adminDoctorManagementService;
    private final UserService userService;

    public AdminDoctorManagementController(AdminDoctorManagementService adminDoctorManagementService,
            UserService userService,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.adminDoctorManagementService = adminDoctorManagementService;
        this.userService = userService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DoctorAdminRow>>> list(
            Authentication authentication,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "50") int size
    ) {
        try {
            List<DoctorAdminRow> data = adminDoctorManagementService.listDoctors(authentication.getName(), page, size);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.admin.doctors.loaded"), data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "ADMIN_DOCTOR_FORBIDDEN"), "ADMIN_DOCTOR_FORBIDDEN"));
        }
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<RegisterResponse>> registerDoctor(
            @RequestBody RegisterRequest request,
            Authentication authentication
    ) {
        try {
            RegisterResponse data = adminDoctorManagementService.registerDoctor(request, authentication.getName());
            return ResponseEntity.status(HttpStatus.CREATED).body(StandardApiResponse.success(messages.success("success.admin.doctor.registered"), data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "ADMIN_DOCTOR_FORBIDDEN"), "ADMIN_DOCTOR_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "ADMIN_DOCTOR_REGISTER_INVALID"), "ADMIN_DOCTOR_REGISTER_INVALID"));
        }
    }

    @PostMapping(value = "/{userId}/deactivate", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> deactivateDoctor(
            @PathVariable String userId,
            Authentication authentication
    ) {
        try {
            userService.deactivateUserAsAdmin(userId, authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.admin.doctor.deactivated"), null));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "ADMIN_DOCTOR_FORBIDDEN"), "ADMIN_DOCTOR_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "ADMIN_DOCTOR_DEACTIVATE_INVALID"), "ADMIN_DOCTOR_DEACTIVATE_INVALID"));
        }
    }
}
