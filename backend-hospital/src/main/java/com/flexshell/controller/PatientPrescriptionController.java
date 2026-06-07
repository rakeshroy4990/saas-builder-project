package com.flexshell.controller;

import com.flexshell.controller.dto.PatientPrescriptionDownloadResponse;
import com.flexshell.controller.dto.PatientPrescriptionDiagnosisGroupSummaryResponse;
import com.flexshell.controller.dto.PatientPrescriptionGroupCreateRequest;
import com.flexshell.controller.dto.PatientPrescriptionGroupCreateResponse;
import com.flexshell.controller.dto.PatientPrescriptionGroupLinkRequest;
import com.flexshell.controller.dto.PatientPrescriptionSaveRequest;
import com.flexshell.controller.dto.PatientPrescriptionSimilarityHitResponse;
import com.flexshell.controller.dto.PatientPrescriptionSummaryResponse;
import com.flexshell.controller.dto.PatientPrescriptionUploadResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.support.EntityListResponseSupport;
import com.flexshell.service.PatientPrescriptionService;
import com.flexshell.service.PatientPrescriptionSimilarityService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import jakarta.servlet.http.HttpServletResponse;

import java.util.List;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient-prescriptions")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PatientPrescriptionController {

    private static final Logger LOG = LoggerFactory.getLogger(PatientPrescriptionController.class);
    private static final MediaType NDJSON = MediaType.parseMediaType("application/x-ndjson");

    private final PatientPrescriptionService patientPrescriptionService;
    private final PatientPrescriptionSimilarityService patientPrescriptionSimilarityService;

    public PatientPrescriptionController(
            PatientPrescriptionService patientPrescriptionService,
            PatientPrescriptionSimilarityService patientPrescriptionSimilarityService
    ) {
        this.patientPrescriptionService = patientPrescriptionService;
        this.patientPrescriptionSimilarityService = patientPrescriptionSimilarityService;
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
    public ResponseEntity<StandardApiResponse<List<PatientPrescriptionSummaryResponse>>> list(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        Page<PatientPrescriptionSummaryResponse> page = patientPrescriptionService.listForActor(userId, pageable);
        return EntityListResponseSupport.ok(
                "Prescriptions fetched",
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements());
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PatientPrescriptionSummaryResponse>> save(
            @RequestBody PatientPrescriptionSaveRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            PatientPrescriptionSummaryResponse data = patientPrescriptionService.save(userId, request);
            return ResponseEntity.ok(StandardApiResponse.success("Prescription saved", data));
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "PATIENT_PRESCRIPTION_SAVE_INVALID");
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @DeleteMapping(value = "/{businessKey}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> delete(
            @PathVariable("businessKey") UUID businessKey,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            patientPrescriptionService.softDelete(userId, businessKey);
            return ResponseEntity.ok(StandardApiResponse.success("Prescription deleted", null));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_PRESCRIPTION_NOT_FOUND"));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
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
        try {
            PatientPrescriptionGroupCreateResponse data = patientPrescriptionService.createGroup(userId, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(StandardApiResponse.success("Group created", data));
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "PATIENT_PRESCRIPTION_GROUP_INVALID");
        }
    }

    @GetMapping(value = "/groups/diagnosis", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<List<PatientPrescriptionDiagnosisGroupSummaryResponse>>> listDiagnosisGroups(
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        List<PatientPrescriptionDiagnosisGroupSummaryResponse> data = patientPrescriptionService.listDiagnosisGroups(userId);
        return ResponseEntity.ok(StandardApiResponse.success("Diagnosis groups fetched", data));
    }

    @PostMapping(
            value = "/groups/{groupExternalId}/link",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<StandardApiResponse<Void>> linkToGroup(
            @PathVariable UUID groupExternalId,
            @RequestBody PatientPrescriptionGroupLinkRequest request,
            Authentication authentication
    ) {
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        try {
            patientPrescriptionService.linkPrescriptionToGroup(userId, groupExternalId, request);
            return ResponseEntity.ok(StandardApiResponse.success("Prescription linked to group", null));
        } catch (IllegalArgumentException ex) {
            boolean notFound = "Group not found".equalsIgnoreCase(Objects.toString(ex.getMessage(), "").trim())
                    || "Prescription not found".equalsIgnoreCase(Objects.toString(ex.getMessage(), "").trim());
            HttpStatus status = notFound ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            String code = notFound ? "PATIENT_PRESCRIPTION_GROUP_NOT_FOUND" : "PATIENT_PRESCRIPTION_GROUP_LINK_INVALID";
            return ResponseEntity.status(status).body(StandardApiResponse.error(ex.getMessage(), code));
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        }
    }

    @PostMapping(
            value = "/similarity-search",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<StandardApiResponse<List<PatientPrescriptionSimilarityHitResponse>>> similaritySearch(
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "limit", defaultValue = "10") int limit,
            Authentication authentication
    ) {
        if (!isDoctorSimilarityUser(authentication)) {
            return forbidden("Prescription similarity search is restricted to doctors.");
        }
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return unauthorized();
        }
        boolean hasFile = file != null && !file.isEmpty();
        String queryText = Objects.toString(query, "").trim();
        if (!hasFile && queryText.isBlank()) {
            return badRequest("Enter search text or upload a prescription file.", "PATIENT_PRESCRIPTION_SIMILARITY_INVALID");
        }
        try {
            List<PatientPrescriptionSimilarityHitResponse> hits = patientPrescriptionSimilarityService.search(
                    userId, hasFile ? file : null, queryText, limit);
            return ResponseEntity.ok(StandardApiResponse.success("Similar prescriptions ranked", hits));
        } catch (IllegalArgumentException ex) {
            return badRequest(ex.getMessage(), "PATIENT_PRESCRIPTION_SIMILARITY_INVALID");
        } catch (SecurityException ex) {
            return forbidden(ex.getMessage());
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "PATIENT_PRESCRIPTION_SIMILARITY_UNAVAILABLE"));
        }
    }

    /**
     * NDJSON stream ({@code ready} → {@code status} → {@code hit} × N → {@code complete}), same framing as
     * {@code POST /api/hospital/ai/chat} with {@code Accept: application/x-ndjson}.
     */
    @PostMapping(
            value = "/similarity-search/stream",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = {"application/x-ndjson", "application/ndjson"}
    )
    public ResponseEntity<StreamingResponseBody> similaritySearchStream(
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "limit", defaultValue = "10") int limit,
            Authentication authentication,
            HttpServletResponse httpResponse
    ) {
        if (!isDoctorSimilarityUser(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String userId = actorId(authentication);
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        boolean hasFile = file != null && !file.isEmpty();
        String queryText = Objects.toString(query, "").trim();
        if (!hasFile && queryText.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        httpResponse.setBufferSize(1024);
        httpResponse.setHeader("X-Accel-Buffering", "no");
        StreamingResponseBody body = patientPrescriptionSimilarityService.streamSearch(
                userId,
                hasFile ? file : null,
                queryText,
                limit
        );
        return ResponseEntity.ok()
                .contentType(NDJSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
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

    private static boolean isDoctorSimilarityUser(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(Objects::nonNull)
                .anyMatch(a -> a.toUpperCase().contains("DOCTOR"));
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
