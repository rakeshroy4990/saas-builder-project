package com.flexshell.controller;

import com.flexshell.controller.dto.PatientPrescriptionDownloadResponse;
import com.flexshell.controller.dto.PatientPrescriptionGroupCreateRequest;
import com.flexshell.controller.dto.PatientPrescriptionGroupCreateResponse;
import com.flexshell.controller.dto.PatientPrescriptionSummaryResponse;
import com.flexshell.controller.dto.PatientPrescriptionUploadResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.PatientPrescriptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient-prescriptions")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PatientPrescriptionController {

    private static final Logger LOG = LoggerFactory.getLogger(PatientPrescriptionController.class);

    private final PatientPrescriptionService patientPrescriptionService;

    public PatientPrescriptionController(PatientPrescriptionService patientPrescriptionService) {
        this.patientPrescriptionService = patientPrescriptionService;
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PatientPrescriptionUploadResponse>> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(name = "groupExternalId", required = false) UUID groupExternalId,
            @RequestParam(name = "pageNumber", required = false) Integer pageNumber,
            @RequestParam(name = "appointmentExternalId", required = false) UUID appointmentExternalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            LOG.warn("patient_prescription_upload_http_unauthorized filePresent={}", file != null && !file.isEmpty());
            return unauthorized();
        }
        LOG.info(
                "patient_prescription_upload_http_request actorPresent=true filePresent={} fileEmpty={} "
                        + "contentType={} size={}",
                file != null,
                file == null || file.isEmpty(),
                file == null ? "(none)" : Objects.toString(file.getContentType(), "").trim(),
                file == null ? -1 : file.getSize()
        );
        try {
            PatientPrescriptionUploadResponse data = patientPrescriptionService.upload(
                    userId, file, groupExternalId, pageNumber, appointmentExternalId);
            HttpStatus status = data.isDuplicate() ? HttpStatus.OK : HttpStatus.CREATED;
            String message = data.isDuplicate()
                    ? "Prescription already exists"
                    : "Prescription uploaded. Extraction in progress.";
            LOG.info(
                    "patient_prescription_upload_http_ok httpStatus={} externalId={} duplicate={} status={}",
                    status.value(),
                    data.externalId(),
                    data.isDuplicate(),
                    data.status()
            );
            return ResponseEntity.status(status).body(StandardApiResponse.success(message, data));
        } catch (IllegalArgumentException ex) {
            LOG.warn(
                    "patient_prescription_upload_http_bad_request errorType={} message={}",
                    ex.getClass().getSimpleName(),
                    ex.getMessage()
            );
            return badRequest(ex.getMessage(), "PATIENT_PRESCRIPTION_INVALID");
        } catch (SecurityException ex) {
            LOG.warn(
                    "patient_prescription_upload_http_forbidden errorType={} message={}",
                    ex.getClass().getSimpleName(),
                    ex.getMessage()
            );
            return forbidden(ex.getMessage());
        } catch (IllegalStateException ex) {
            LOG.error(
                    "patient_prescription_upload_http_storage_unavailable errorType={} message={} causeType={} "
                            + "causeMessage={}",
                    ex.getClass().getSimpleName(),
                    ex.getMessage(),
                    ex.getCause() == null ? "none" : ex.getCause().getClass().getSimpleName(),
                    ex.getCause() == null ? "" : Objects.toString(ex.getCause().getMessage(), ""),
                    ex
            );
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_PRESCRIPTION_STORAGE_UNAVAILABLE"));
        } catch (Exception ex) {
            LOG.error(
                    "patient_prescription_upload_http_unexpected errorType={} message={}",
                    ex.getClass().getSimpleName(),
                    ex.getMessage(),
                    ex
            );
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(StandardApiResponse.error(
                            "Prescription upload failed unexpectedly. Check server logs for "
                                    + "patient_prescription_upload_* entries.",
                            "PATIENT_PRESCRIPTION_UPLOAD_FAILED"
                    ));
        }
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Page<PatientPrescriptionSummaryResponse>>> list(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        Page<PatientPrescriptionSummaryResponse> page = patientPrescriptionService.listForActor(userId, pageable);
        return ResponseEntity.ok(StandardApiResponse.success("Prescriptions fetched", page));
    }

    @GetMapping(value = "/{externalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PatientPrescriptionSummaryResponse>> get(
            @PathVariable UUID externalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            PatientPrescriptionSummaryResponse data = patientPrescriptionService.getMetadata(userId, externalId);
            return ResponseEntity.ok(StandardApiResponse.success("Prescription fetched", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_PRESCRIPTION_NOT_FOUND"));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @GetMapping(value = "/{externalId}/download", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PatientPrescriptionDownloadResponse>> download(
            @PathVariable UUID externalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            PatientPrescriptionDownloadResponse data = patientPrescriptionService.downloadUrl(userId, externalId);
            return ResponseEntity.ok(StandardApiResponse.success("Signed URL ready", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_PRESCRIPTION_NOT_FOUND"));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_PRESCRIPTION_STORAGE_UNAVAILABLE"));
        }
    }

    @PostMapping(value = "/groups", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PatientPrescriptionGroupCreateResponse>> createGroup(
            @RequestBody PatientPrescriptionGroupCreateRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        PatientPrescriptionGroupCreateResponse data = patientPrescriptionService.createGroup(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(StandardApiResponse.success("Group created", data));
    }

    @GetMapping(value = "/groups/{groupExternalId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<PatientPrescriptionSummaryResponse>>> listGroup(
            @PathVariable UUID groupExternalId,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            List<PatientPrescriptionSummaryResponse> data = patientPrescriptionService.listGroupItems(userId, groupExternalId);
            return ResponseEntity.ok(StandardApiResponse.success("Group prescriptions fetched", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_PRESCRIPTION_GROUP_NOT_FOUND"));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private static <T> ResponseEntity<StandardApiResponse<T>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(StandardApiResponse.error("Authentication required.", "AUTH_REQUIRED"));
    }

    private static <T> ResponseEntity<StandardApiResponse<T>> forbidden(String message) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(StandardApiResponse.error(message.isBlank() ? "Forbidden" : message, "PATIENT_PRESCRIPTION_FORBIDDEN"));
    }

    private static <T> ResponseEntity<StandardApiResponse<T>> badRequest(String message, String code) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(StandardApiResponse.error(message.isBlank() ? "Invalid request" : message, code));
    }
}
