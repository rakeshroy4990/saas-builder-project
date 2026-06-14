package com.flexshell.controller;

import com.flexshell.controller.dto.PrescriptionValidationResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.PrescriptionValidationService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/patient-prescriptions")
public class PrescriptionValidationController {

    private final PrescriptionValidationService validationService;
    private final LocalizedApiMessages messages;

    public PrescriptionValidationController(
            PrescriptionValidationService validationService,
            LocalizedApiMessages messages
    ) {
        this.validationService = validationService;
        this.messages = messages;
    }

    @GetMapping(value = "/{externalId}/validation", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PrescriptionValidationResponse>> getLatest(
            @PathVariable UUID externalId
    ) {
        return validationService.getLatestForPatientPrescription(externalId)
                .map(data -> ResponseEntity.ok(
                        StandardApiResponse.success(messages.success("success.patient.prescription.validation.loaded"), data)
                ))
                .orElseGet(() -> ResponseEntity.ok(
                        StandardApiResponse.success(messages.success("success.patient.prescription.validation.none"), null)
                ));
    }

    @PostMapping(value = "/{externalId}/validation/revalidate", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PrescriptionValidationResponse>> revalidate(
            @PathVariable UUID externalId,
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader
    ) {
        PrescriptionValidationResponse data = validationService.validatePatientPrescription(externalId, authorizationHeader);
        return ResponseEntity.ok(
                StandardApiResponse.success(messages.success("success.patient.prescription.validation.completed"), data)
        );
    }

    @PreAuthorize("hasRole('DOCTOR')")
    @PostMapping(value = "/{externalId}/validation/review", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<PrescriptionValidationResponse>> review(
            @PathVariable UUID externalId,
            Authentication authentication
    ) {
        String actor = authentication == null ? null : authentication.getName();
        PrescriptionValidationResponse data = validationService.markReviewed(externalId, actor);
        return ResponseEntity.ok(
                StandardApiResponse.success(messages.success("success.patient.prescription.validation.reviewed"), data)
        );
    }
}
