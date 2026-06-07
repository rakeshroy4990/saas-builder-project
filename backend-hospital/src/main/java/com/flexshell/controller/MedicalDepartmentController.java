package com.flexshell.controller;

import com.flexshell.auth.i18n.RequestLocaleAttributes;
import com.flexshell.controller.dto.MedicalDepartmentRequest;
import com.flexshell.controller.dto.MedicalDepartmentResponse;
import com.flexshell.controller.dto.PagedMedicalDepartmentListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.service.MedicalDepartmentService;
import jakarta.servlet.http.HttpServletRequest;
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
@RequestMapping({"/api/medical-department", "/api/Em"})
public class MedicalDepartmentController {
    private final ObjectProvider<MedicalDepartmentService> serviceProvider;

    public MedicalDepartmentController(ObjectProvider<MedicalDepartmentService> serviceProvider) {
        this.serviceProvider = serviceProvider;
    }

    @PostMapping(value = "/create", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> create(
            @RequestBody MedicalDepartmentRequest request,
            HttpServletRequest servletRequest
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            MedicalDepartmentResponse data = service.create(request, locale);
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
            @RequestBody MedicalDepartmentRequest request,
            HttpServletRequest servletRequest
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            MedicalDepartmentResponse data = service.update(id, request, locale);
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

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> deleteByBusinessKey(@PathVariable String businessKey) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error("Medical department service is unavailable", "MEDICAL_DEPARTMENT_SERVICE_UNAVAILABLE"));
        }
        try {
            if (!service.deleteByBusinessKey(businessKey)) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(StandardApiResponse.error("Medical department not found", "MEDICAL_DEPARTMENT_NOT_FOUND"));
            }
            return ResponseEntity.ok(StandardApiResponse.success("Medical department deleted", null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_NOT_FOUND"));
        }
    }

    @GetMapping(value = "/get/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> getById(
            @PathVariable String id,
            HttpServletRequest servletRequest
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            MedicalDepartmentResponse data = service.getById(id, locale);
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
            @RequestParam(name = "size", defaultValue = "20") int size,
            HttpServletRequest servletRequest
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error("Medical department service is unavailable", "MEDICAL_DEPARTMENT_SERVICE_UNAVAILABLE"));
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            PagedMedicalDepartmentListDto paged = service.listPaged(
                    page,
                    size,
                    new com.flexshell.controller.dto.MedicalDepartmentQueryDto(),
                    locale);
            return EntityListResponseSupport.ok(
                    "Medical departments fetched",
                    paged.getContent(),
                    paged.getNumber(),
                    paged.getSize(),
                    paged.getTotalElements());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_LIST_INVALID"));
        }
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> save(
            @RequestBody MedicalDepartmentRequest request,
            HttpServletRequest servletRequest
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            MedicalDepartmentResponse data = service.createOrUpdate(request, locale);
            return ResponseEntity.ok(StandardApiResponse.success("Medical department saved", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_SAVE_INVALID"));
        } catch (IllegalStateException ex) {
            return unavailableResponse();
        }
    }

    @PostMapping(value = "/createOrUpdate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<MedicalDepartmentResponse>> createOrUpdate(
            @RequestBody MedicalDepartmentRequest request,
            HttpServletRequest servletRequest
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailableResponse();
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            MedicalDepartmentResponse data = service.createOrUpdate(request, locale);
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
