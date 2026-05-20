package com.flexshell.controller;

import com.flexshell.controller.dto.StandardApiResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/patient-device-readings")
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "mongo", matchIfMissing = true)
public class PatientDeviceReadingDisabledController {

    @RequestMapping(value = "/**", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<Void>> unavailable() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(StandardApiResponse.error(
                        "Patient device readings require PostgreSQL. Set APP_PERSISTENCE_PROVIDER=postgres.",
                        "PATIENT_DEVICE_READINGS_POSTGRES_REQUIRED"
                ));
    }
}
