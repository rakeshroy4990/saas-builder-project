package com.flexshell.controller;

import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.SmartAiQuotaExceededException;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.EducationPrescriptionTranscriptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Objects;

@RestController
@RequestMapping("/api/hospital/education")
public class HospitalEducationPrescriptionController {
    private static final Logger LOG = LoggerFactory.getLogger(HospitalEducationPrescriptionController.class);
    private final EducationPrescriptionTranscriptionService transcriptionService;

    public HospitalEducationPrescriptionController(EducationPrescriptionTranscriptionService transcriptionService) {
        this.transcriptionService = transcriptionService;
    }

    /**
     * Multipart field {@code file}: PDF or image (JPEG/PNG/WebP). Doctor-only; counts toward Smart AI daily quota.
     */
    @PostMapping(value = "/prescription-transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<EducationPrescriptionTranscribeData>> transcribePrescription(
            @RequestPart("file") MultipartFile file,
            Authentication authentication
    ) {
        if (!isDoctorEducationTranscriptionUser(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error("Prescription transcription is restricted to doctors.", "EDUCATION_PRESCRIPTION_FORBIDDEN"));
        }
        String userId = authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error("Authentication required.", "AUTH_REQUIRED"));
        }
        try {
            EducationPrescriptionTranscribeData data = transcriptionService.transcribe(userId, file);
            if (data == null) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(StandardApiResponse.error("Transcription returned empty data.", "EDUCATION_PRESCRIPTION_EMPTY"));
            }
            return ResponseEntity.ok(StandardApiResponse.success("Transcription ready", data));
        } catch (IllegalArgumentException ex) {
            String msg = Objects.toString(ex.getMessage(), "Invalid request").trim();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(msg.isBlank() ? "Invalid request" : msg, "EDUCATION_PRESCRIPTION_INVALID"));
        } catch (SmartAiQuotaExceededException ex) {
            HttpStatus status = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.BAD_REQUEST;
            String code = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                    ? "AI_SMART_QUOTA_DAILY"
                    : "AI_SMART_QUOTA_TOKEN";
            LOG.warn("education_prescription_transcribe quota kind={}", ex.kind());
            return ResponseEntity.status(status)
                    .body(StandardApiResponse.error(ex.getMessage(), code));
        } catch (AiProviderException ex) {
            String code = ex.kind() == AiProviderException.Kind.CONFIG_MISSING
                    ? "AI_CONFIG_MISSING"
                    : "AI_PROVIDER_FAILED";
            LOG.warn("education_prescription_transcribe provider_fail kind={}", ex.kind());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), code));
        }
    }

    private static boolean isDoctorEducationTranscriptionUser(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(Objects::nonNull)
                .anyMatch(a -> {
                    String u = a.toUpperCase();
                    return u.contains("DOCTOR");
                });
    }
}
