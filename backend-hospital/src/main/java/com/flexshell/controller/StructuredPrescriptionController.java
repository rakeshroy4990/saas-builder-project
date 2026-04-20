package com.flexshell.controller;

import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.StructuredPrescriptionResponse;
import com.flexshell.prescription.StructuredPrescriptionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/prescription")
public class StructuredPrescriptionController {

    private final StructuredPrescriptionService structuredPrescriptionService;

    public StructuredPrescriptionController(StructuredPrescriptionService structuredPrescriptionService) {
        this.structuredPrescriptionService = structuredPrescriptionService;
    }

    @PostMapping(value = "/appointment/{appointmentId}/ensure-draft", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<StructuredPrescriptionResponse>> ensureDraft(
            @PathVariable String appointmentId,
            Authentication authentication
    ) {
        try {
            StructuredPrescriptionResponse data = structuredPrescriptionService.getOrCreateDraft(
                    appointmentId,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Prescription draft ready", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_INVALID"));
        }
    }

    @PutMapping(value = "/appointment/{appointmentId}/draft", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<StructuredPrescriptionResponse>> saveDraft(
            @PathVariable String appointmentId,
            @RequestBody Map<String, Object> body,
            Authentication authentication
    ) {
        try {
            StructuredPrescriptionResponse data = structuredPrescriptionService.saveDraft(
                    appointmentId,
                    body,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Draft saved", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_INVALID"));
        }
    }

    @PostMapping(value = "/appointment/{appointmentId}/validate", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<StructuredPrescriptionResponse>> validate(
            @PathVariable String appointmentId,
            Authentication authentication
    ) {
        try {
            StructuredPrescriptionResponse data = structuredPrescriptionService.validate(
                    appointmentId,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Validation run", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_INVALID"));
        }
    }

    @PostMapping(value = "/appointment/{appointmentId}/finalize", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<StructuredPrescriptionResponse>> finalize(
            @PathVariable String appointmentId,
            Authentication authentication,
            HttpServletRequest request
    ) {
        try {
            StructuredPrescriptionResponse data = structuredPrescriptionService.finalize(
                    appointmentId,
                    authentication.getName(),
                    request.getRemoteAddr());
            return ResponseEntity.ok(StandardApiResponse.success("Prescription signed and locked", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_INVALID"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_FINALIZE_FAILED"));
        }
    }

    @GetMapping(value = "/appointment/{appointmentId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<StructuredPrescriptionResponse>> get(
            @PathVariable String appointmentId,
            Authentication authentication
    ) {
        try {
            StructuredPrescriptionResponse data = structuredPrescriptionService.get(
                    appointmentId,
                    authentication.getName());
            return ResponseEntity.ok(StandardApiResponse.success("Prescription fetched", data));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_FORBIDDEN"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(StandardApiResponse.error(ex.getMessage(), "PRESCRIPTION_NOT_FOUND"));
        }
    }

    @GetMapping(value = "/appointment/{appointmentId}/pdf")
    public ResponseEntity<byte[]> getPdf(
            @PathVariable String appointmentId,
            Authentication authentication
    ) {
        try {
            byte[] pdf = structuredPrescriptionService.getPdfBytes(appointmentId, authentication.getName());
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"eprescription-" + appointmentId + ".pdf\"")
                    .body(pdf);
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
