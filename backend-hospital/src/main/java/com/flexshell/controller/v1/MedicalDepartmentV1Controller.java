package com.flexshell.controller.v1;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.auth.i18n.RequestLocaleAttributes;
import com.flexshell.controller.dto.MedicalDepartmentQueryDto;
import com.flexshell.controller.dto.MedicalDepartmentRequest;
import com.flexshell.controller.dto.MedicalDepartmentResponse;
import com.flexshell.controller.dto.PagedMedicalDepartmentListDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.controller.support.EntityQueryBinder;
import com.flexshell.service.MedicalDepartmentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/v1/medical-departments")
public class MedicalDepartmentV1Controller {

    private static final Set<String> QUERY_KEYS = Set.of("Code", "Name", "Active");

    private final ObjectProvider<MedicalDepartmentService> serviceProvider;
    private final ObjectMapper objectMapper;

    public MedicalDepartmentV1Controller(
            ObjectProvider<MedicalDepartmentService> serviceProvider,
            ObjectMapper objectMapper
    ) {
        this.serviceProvider = serviceProvider;
        this.objectMapper = objectMapper;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<MedicalDepartmentResponse>>> list(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size,
            @RequestParam(name = "Query", required = false) String queryJson,
            @ModelAttribute MedicalDepartmentQueryDto query,
            HttpServletRequest servletRequest
    ) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailable();
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            EntityQueryBinder.bind(query, queryJson, objectMapper, QUERY_KEYS);
            PagedMedicalDepartmentListDto paged = service.listPaged(page, size, query, locale);
            return EntityListResponseSupport.ok(
                    "Medical departments loaded",
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
            return unavailable();
        }
        String locale = RequestLocaleAttributes.readResolvedLocale(servletRequest);
        try {
            MedicalDepartmentResponse data = service.createOrUpdate(request, locale);
            return ResponseEntity.ok(StandardApiResponse.success("Medical department saved", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "MEDICAL_DEPARTMENT_SAVE_INVALID"));
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(@PathVariable String businessKey) {
        MedicalDepartmentService service = serviceProvider.getIfAvailable();
        if (service == null) {
            return unavailable();
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

    private static <T> ResponseEntity<StandardApiResponse<T>> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(StandardApiResponse.error("Medical department service is unavailable", "MEDICAL_DEPARTMENT_SERVICE_UNAVAILABLE"));
    }
}
