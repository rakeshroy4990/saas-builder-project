package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.ai.AiProviderException;
import com.flexshell.ai.SmartAiQuotaExceededException;
import com.flexshell.controller.dto.EducationPrescriptionTranscribeData;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.prescription.PrescriptionTranscribeTiming;
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
    private final LocalizedApiMessages messages;

    private static final Logger LOG = LoggerFactory.getLogger(HospitalEducationPrescriptionController.class);
    private final EducationPrescriptionTranscriptionService transcriptionService;

    public HospitalEducationPrescriptionController(EducationPrescriptionTranscriptionService transcriptionService,
            LocalizedApiMessages messages) {
        this.messages = messages;

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
                    .body(StandardApiResponse.error(messages.forErrorCode("EDUCATION_PRESCRIPTION_FORBIDDEN"), "EDUCATION_PRESCRIPTION_FORBIDDEN"));
        }
        String userId = authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
        if (userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(StandardApiResponse.error(messages.forErrorCode("AUTH_REQUIRED"), "AUTH_REQUIRED"));
        }
        long httpStartNanos = System.nanoTime();
        LOG.info(
                "education_prescription_transcribe_request filePresent={} fileSize={} contentType={}",
                file != null && !file.isEmpty(),
                file == null ? -1 : file.getSize(),
                file == null ? "" : Objects.toString(file.getContentType(), "").trim()
        );
        try {
            EducationPrescriptionTranscribeData data = transcriptionService.transcribe(userId, file);
            if (data == null) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(StandardApiResponse.error(messages.forErrorCode("EDUCATION_PRESCRIPTION_EMPTY"), "EDUCATION_PRESCRIPTION_EMPTY"));
            }
            long httpTotalMs = Math.max(0L, (System.nanoTime() - httpStartNanos) / 1_000_000L);
            PrescriptionTranscribeTiming timing = PrescriptionTranscribeTiming.currentOrNull();
            if (timing != null) {
                LOG.info(
                        "education_prescription_transcribe_http totalMs={} slowest=[{}]",
                        httpTotalMs,
                        timing.topStepSummary()
                );
            } else {
                LOG.info("education_prescription_transcribe_http totalMs={}", httpTotalMs);
            }
            ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
            if (timing != null) {
                String serverTiming = timing.toServerTimingHeader();
                if (!serverTiming.isBlank()) {
                    builder.header("Server-Timing", serverTiming);
                }
            }
            return builder.body(StandardApiResponse.success(messages.success("success.education.prescription.transcription"), data));
        } catch (IllegalArgumentException ex) {
            logTranscribeHttpOutcome(httpStartNanos, "bad_request");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.resolveException(ex, "EDUCATION_PRESCRIPTION_INVALID"), "EDUCATION_PRESCRIPTION_INVALID"));
        } catch (SmartAiQuotaExceededException ex) {
            HttpStatus status = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                    ? HttpStatus.TOO_MANY_REQUESTS
                    : HttpStatus.BAD_REQUEST;
            String code = ex.kind() == SmartAiQuotaExceededException.Kind.DAILY
                    ? "AI_SMART_QUOTA_DAILY"
                    : "AI_SMART_QUOTA_TOKEN";
            LOG.warn("education_prescription_transcribe quota kind={}", ex.kind());
            logTranscribeHttpOutcome(httpStartNanos, "quota");
            return ResponseEntity.status(status)
                    .body(StandardApiResponse.error(messages.forErrorCode(code), code));
        } catch (AiProviderException ex) {
            String code = ex.kind() == AiProviderException.Kind.CONFIG_MISSING
                    ? "AI_CONFIG_MISSING"
                    : "AI_PROVIDER_FAILED";
            LOG.warn("education_prescription_transcribe provider_fail kind={}", ex.kind());
            logTranscribeHttpOutcome(httpStartNanos, "provider_failed");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(messages.forErrorCode(code), code));
        } finally {
            PrescriptionTranscribeTiming timing = PrescriptionTranscribeTiming.currentOrNull();
            if (timing != null) {
                timing.close();
            }
        }
    }

    private static void logTranscribeHttpOutcome(long httpStartNanos, String outcome) {
        long httpTotalMs = Math.max(0L, (System.nanoTime() - httpStartNanos) / 1_000_000L);
        PrescriptionTranscribeTiming timing = PrescriptionTranscribeTiming.currentOrNull();
        if (timing != null) {
            LOG.info(
                    "education_prescription_transcribe_http outcome={} totalMs={} slowest=[{}]",
                    outcome,
                    httpTotalMs,
                    timing.topStepSummary()
            );
        } else {
            LOG.info("education_prescription_transcribe_http outcome={} totalMs={}", outcome, httpTotalMs);
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
