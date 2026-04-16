package com.flexshell.controller;

import com.flexshell.controller.dto.DoctorOptionResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.DoctorDirectoryService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/doctor")
public class DoctorDirectoryController {
    private final ObjectProvider<DoctorDirectoryService> doctorDirectoryServiceProvider;

    public DoctorDirectoryController(ObjectProvider<DoctorDirectoryService> doctorDirectoryServiceProvider) {
        this.doctorDirectoryServiceProvider = doctorDirectoryServiceProvider;
    }

    @GetMapping(value = "/get", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<DoctorOptionResponse>>> getByDepartment(
            @RequestParam(name = "department") String department,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        DoctorDirectoryService service = doctorDirectoryServiceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error("Doctor directory service is unavailable", "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
        try {
            List<DoctorOptionResponse> doctors = service.getDoctorsByDepartment(department, page, size);
            return ResponseEntity.ok(StandardApiResponse.success("Doctors fetched", doctors));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "DOCTOR_DIRECTORY_INVALID_REQUEST"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error("Doctor directory service is unavailable", "DOCTOR_DIRECTORY_SERVICE_UNAVAILABLE"));
        }
    }
}
