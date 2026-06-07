package com.flexshell.controller;

import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.i18n.LocalizedApiMessages;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Clear error when patient prescriptions are requested in Mongo persistence mode
 * (real API is only registered for {@code app.persistence.provider=postgres}).
 */
@RestController
@RequestMapping("/api/v1/patient-prescriptions")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "mongo", matchIfMissing = true)
public class PatientPrescriptionDisabledController {

    private final LocalizedApiMessages messages;

    public PatientPrescriptionDisabledController(LocalizedApiMessages messages) {
        this.messages = messages;
    }

    @RequestMapping(value = "/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> unavailable() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(StandardApiResponse.error(
                        messages.forErrorCode("PATIENT_PRESCRIPTIONS_POSTGRES_REQUIRED"),
                        "PATIENT_PRESCRIPTIONS_POSTGRES_REQUIRED"
                ));
    }
}
