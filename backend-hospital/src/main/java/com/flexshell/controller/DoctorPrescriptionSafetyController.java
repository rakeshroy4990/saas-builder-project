package com.flexshell.controller;

import com.flexshell.controller.dto.DoctorPrescriptionSafetyValidateRequest;
import com.flexshell.controller.dto.PrescriptionValidationResponse;
import com.flexshell.controller.dto.RecommendedDosageRequest;
import com.flexshell.controller.dto.RecommendedDosageResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.BytesMultipartFile;
import com.flexshell.service.PrescriptionValidationService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.util.Objects;

@RestController
@RequestMapping("/api/hospital/education/prescription-safety")
public class DoctorPrescriptionSafetyController {

    private static final Logger LOG = LoggerFactory.getLogger(DoctorPrescriptionSafetyController.class);
    private static final MediaType NDJSON = MediaType.parseMediaType("application/x-ndjson");

    private final PrescriptionValidationService validationService;
    private final LocalizedApiMessages messages;

    public DoctorPrescriptionSafetyController(
            PrescriptionValidationService validationService,
            LocalizedApiMessages messages
    ) {
        this.validationService = validationService;
        this.messages = messages;
    }

    @PostMapping(value = "/validate", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PrescriptionValidationResponse>> validate(
            @RequestBody DoctorPrescriptionSafetyValidateRequest request,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        if (!isDoctor(authentication)) {
            return forbidden();
        }
        String actorUserId = actorId(authentication);
        try {
            PrescriptionValidationResponse data = validationService.validateForDoctor(
                    actorUserId,
                    request,
                    authorizationHeader
            );
            return ResponseEntity.ok(
                    StandardApiResponse.success(messages.success("success.doctor.prescription.safety.validated"), data)
            );
        } catch (IllegalArgumentException ex) {
            String code = errorCodeOrDefault(ex, "PRESCRIPTION_SAFETY_VALIDATE_FAILED");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, code), code));
        } catch (SecurityException ex) {
            return forbidden();
        } catch (IllegalStateException ex) {
            String code = errorCodeOrDefault(ex, "PRESCRIPTION_VALIDATION_SERVICE_FAILED");
            LOG.warn("doctor_prescription_validate_unavailable code={} message={}", code, ex.getMessage());
            return serviceUnavailable(code, ex);
        }
    }

    @PostMapping(value = "/validate-upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PrescriptionValidationResponse>> validateUpload(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "childProfileExternalId", required = false) String childProfileExternalId,
            @RequestPart(value = "childAgeMonths", required = false) String childAgeMonths,
            @RequestPart(value = "childWeightKg", required = false) String childWeightKg,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        if (!isDoctor(authentication)) {
            return forbidden();
        }
        String actorUserId = actorId(authentication);
        try {
            PrescriptionValidationResponse data = validationService.validatePrescriptionUploadFromFile(
                    actorUserId,
                    file,
                    childProfileExternalId,
                    childAgeMonths,
                    childWeightKg,
                    authorizationHeader
            );
            return ResponseEntity.ok(
                    StandardApiResponse.success(messages.success("success.doctor.prescription.safety.validated"), data)
            );
        } catch (IllegalArgumentException ex) {
            String code = errorCodeOrDefault(ex, "PRESCRIPTION_SAFETY_VALIDATE_FAILED");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, code), code));
        } catch (SecurityException ex) {
            return forbidden();
        } catch (IllegalStateException ex) {
            String code = errorCodeOrDefault(ex, "PRESCRIPTION_VALIDATION_SERVICE_FAILED");
            LOG.warn("doctor_prescription_validate_upload_unavailable code={} message={}", code, ex.getMessage());
            return serviceUnavailable(code, ex);
        }
    }

    @PostMapping(
            value = "/transcribe-upload/stream",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = {"application/x-ndjson", "application/ndjson"}
    )
    public ResponseEntity<StreamingResponseBody> transcribeUploadStream(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "childProfileExternalId", required = false) String childProfileExternalId,
            @RequestPart(value = "childAgeMonths", required = false) String childAgeMonths,
            @RequestPart(value = "childWeightKg", required = false) String childWeightKg,
            Authentication authentication,
            HttpServletResponse httpResponse
    ) {
        if (!isDoctor(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String actorUserId = actorId(authentication);
        if (actorUserId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        final byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        BytesMultipartFile bufferedFile = new BytesMultipartFile(
                file.getName() != null ? file.getName() : "file",
                file.getOriginalFilename(),
                file.getContentType(),
                fileBytes
        );
        httpResponse.setBufferSize(1024);
        httpResponse.setHeader("X-Accel-Buffering", "no");
        httpResponse.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        StreamingResponseBody body = validationService.streamTranscribePrescriptionUploadFromFile(
                actorUserId,
                bufferedFile,
                childProfileExternalId,
                childAgeMonths,
                childWeightKg
        );
        return ResponseEntity.ok()
                .contentType(NDJSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
    }

    @PostMapping(
            value = "/validate-upload/stream",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = {"application/x-ndjson", "application/ndjson"}
    )
    public ResponseEntity<StreamingResponseBody> validateUploadStream(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "childProfileExternalId", required = false) String childProfileExternalId,
            @RequestPart(value = "childAgeMonths", required = false) String childAgeMonths,
            @RequestPart(value = "childWeightKg", required = false) String childWeightKg,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            HttpServletResponse httpResponse
    ) {
        if (!isDoctor(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        String actorUserId = actorId(authentication);
        if (actorUserId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        final byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        BytesMultipartFile bufferedFile = new BytesMultipartFile(
                file.getName() != null ? file.getName() : "file",
                file.getOriginalFilename(),
                file.getContentType(),
                fileBytes
        );
        httpResponse.setBufferSize(1024);
        httpResponse.setHeader("X-Accel-Buffering", "no");
        httpResponse.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        StreamingResponseBody body = validationService.streamValidatePrescriptionUploadFromFile(
                actorUserId,
                bufferedFile,
                childProfileExternalId,
                childAgeMonths,
                childWeightKg,
                authorizationHeader
        );
        return ResponseEntity.ok()
                .contentType(NDJSON)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(body);
    }

    @PostMapping(value = "/recommended-dosage", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<RecommendedDosageResponse>> recommendedDosage(
            @RequestBody RecommendedDosageRequest request,
            Authentication authentication,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        if (!isDoctor(authentication)) {
            return forbidden();
        }
        String actorUserId = actorId(authentication);
        try {
            RecommendedDosageResponse data = validationService.recommendDosageForDoctor(
                    actorUserId,
                    request,
                    authorizationHeader
            );
            return ResponseEntity.ok(
                    StandardApiResponse.success(messages.success("success.doctor.prescription.safety.recommended"), data)
            );
        } catch (IllegalArgumentException ex) {
            String code = errorCodeOrDefault(ex, "RECOMMENDED_DOSAGE_INVALID");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, code), code));
        } catch (SecurityException ex) {
            return forbidden();
        } catch (IllegalStateException ex) {
            String code = errorCodeOrDefault(ex, "RECOMMENDED_DOSAGE_SERVICE_FAILED");
            LOG.warn("doctor_recommended_dosage_unavailable code={} message={}", code, ex.getMessage());
            return serviceUnavailable(code, ex);
        }
    }

    private static boolean isDoctor(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(Objects::nonNull)
                .anyMatch(a -> a.toUpperCase().contains("DOCTOR"));
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private <T> ResponseEntity<StandardApiResponse<T>> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(StandardApiResponse.error(messages.forErrorCode("EDUCATION_PRESCRIPTION_FORBIDDEN"), "EDUCATION_PRESCRIPTION_FORBIDDEN"));
    }

    private <T> ResponseEntity<StandardApiResponse<T>> serviceUnavailable(String code, Exception ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(StandardApiResponse.error(messages.resolveException(ex, code), code));
    }

    private static String errorCodeOrDefault(Exception ex, String fallback) {
        String msg = Objects.toString(ex.getMessage(), "").trim();
        if (msg.matches("[A-Z][A-Z0-9_]+")) {
            return msg;
        }
        return fallback;
    }
}
