package com.flexshell.controller;

import com.flexshell.controller.dto.StandardApiResponse;
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

    @RequestMapping(value = "/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> unavailable() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(StandardApiResponse.error(
                        "Patient prescriptions require PostgreSQL. Set APP_PERSISTENCE_PROVIDER=postgres, "
                                + "configure SPRING_DATASOURCE_URL, and run Flyway migrations.",
                        "PATIENT_PRESCRIPTIONS_POSTGRES_REQUIRED"
                ));
    }
}
