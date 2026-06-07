package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.auth.i18n.RequestLocaleAttributes;
import com.flexshell.controller.dto.DoctorOptionResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.DoctorDirectoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/doctor")
public class DoctorDirectoryController {
    private final LocalizedApiMessages messages;

    private final ObjectProvider<DoctorDirectoryService> doctorDirectoryServiceProvider;

    public DoctorDirectoryController(ObjectProvider<DoctorDirectoryService> doctorDirectoryServiceProvider,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.doctorDirectoryServiceProvider = doctorDirectoryServiceProvider;
    }

    @GetMapping(value = "/get", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DoctorOptionResponse>>> getByDepartment(
            @RequestParam(name = "department") String department,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            HttpServletRequest servletRequest
    ) {
        DoctorDirectoryService service = doctorDirectoryServiceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(messages.forErrorCode("DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"), "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            List<DoctorOptionResponse> doctors = service.getDoctorsByDepartment(department, page, size, locale);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.directory.fetched"), doctors));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_DIRECTORY_INVALID_REQUEST"), "DOCTOR_DIRECTORY_INVALID_REQUEST"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(messages.forErrorCode("DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"), "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
    }

    @GetMapping(value = "/list-active", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DoctorOptionResponse>>> listActiveForAdmin(
            Authentication authentication,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "200") int size,
            HttpServletRequest servletRequest
    ) {
        DoctorDirectoryService service = doctorDirectoryServiceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(messages.forErrorCode("DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"), "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            List<DoctorOptionResponse> doctors = service.listActiveDoctorsForAdmin(
                    authentication.getName(),
                    page,
                    size,
                    locale
            );
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.directory.fetched"), doctors));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_LIST_FORBIDDEN"), "DOCTOR_LIST_FORBIDDEN"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"), "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
    }

    @GetMapping(value = "/list-public", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DoctorOptionResponse>>> listPublic(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "100") int size,
            HttpServletRequest servletRequest
    ) {
        DoctorDirectoryService service = doctorDirectoryServiceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(messages.forErrorCode("DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"), "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            List<DoctorOptionResponse> doctors = service.listActiveDoctorsPublic(page, size, locale);
            return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.doctor.directory.fetched"), doctors));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(messages.forErrorCode("DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"), "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
    }
}
