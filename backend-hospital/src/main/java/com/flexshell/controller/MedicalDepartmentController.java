package com.flexshell.controller;

import com.flexshell.controller.dto.MedicalDepartmentRequest;
import com.flexshell.controller.dto.MedicalDepartmentResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.MedicalDepartmentService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/medical-department")
public class MedicalDepartmentController {
    private final ObjectProvider<MedicalDepartmentService> serviceProvider;

    public MedicalDepartmentController(ObjectProvider<MedicalDepartmentService> serviceProvider) {
        this.serviceProvider = serviceProvider;
    }

    @PostMapping(value = "/create", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> create(@RequestBody MedicalDepartmentRequest request) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        try {
            MedicalDepartmentResponse data = service.create(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(StandardApiResponse.success("Medical department created", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_CREATE_INVALID"));
        } catch (IllegalStateException ex) {
            return unavailableResponse();
        }
    }

    @PutMapping(value = "/update/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> update(
            @PathVariable String id,
            @RequestBody MedicalDepartmentRequest request
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        try {
            MedicalDepartmentResponse data = service.update(id, request);
            return ResponseEntity.ok(StandardApiResponse.success("Medical department updated", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_UPDATE_INVALID"));
        } catch (IllegalStateException ex) {
            return unavailableResponse();
        }
    }

    @DeleteMapping(value = "/delete/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(@PathVariable String id) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error("Medical department service is unavailable", "MEDICAL_DEPARTMENT_SERVICE_UNAVAILABLE"));
        }
        if (!service.delete(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error("Medical department not found", "MEDICAL_DEPARTMENT_NOT_FOUND"));
        }
        return ResponseEntity.ok(StandardApiResponse.success("Medical department deleted", null));
    }

    @GetMapping(value = "/get/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> getById(@PathVariable String id) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        try {
            MedicalDepartmentResponse data = service.getById(id);
            return ResponseEntity.ok(StandardApiResponse.success("Medical department fetched", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_NOT_FOUND"));
        } catch (IllegalStateException ex) {
            return unavailableResponse();
        }
    }

    @GetMapping(value = "/get", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<MedicalDepartmentResponse>>> getAll(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error("Medical department service is unavailable", "MEDICAL_DEPARTMENT_SERVICE_UNAVAILABLE"));
        }
        List<MedicalDepartmentResponse> data = service.getAll(page, size);
        return ResponseEntity.ok(StandardApiResponse.success("Medical departments fetched", data));
    }

    @PostMapping(value = "/createOrUpdate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> createOrUpdate(
            @RequestBody MedicalDepartmentRequest request
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        try {
            MedicalDepartmentResponse data = service.createOrUpdate(request);
            return ResponseEntity.ok(StandardApiResponse.success("Medical department createOrUpdate successful", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_CREATE_OR_UPDATE_INVALID"));
        } catch (IllegalStateException ex) {
            return unavailableResponse();
        }
    }

    private ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> unavailableResponse() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(StandardApiResponse.error("Medical department service is unavailable", "MEDICAL_DEPARTMENT_SERVICE_UNAVAILABLE"));
    }
}
