package com.flexshell.service;

import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.PatientDeviceReadingCreateRequest;
import com.flexshell.controller.dto.PatientDeviceReadingResponse;
import com.flexshell.persistence.postgres.model.PatientDeviceReadingJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.PatientDeviceReadingJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class PatientDeviceReadingService {

    private static final Logger LOG = LoggerFactory.getLogger(PatientDeviceReadingService.class);

    private final PatientDeviceReadingJpaRepository readingRepository;
    private final UserJpaRepository userRepository;

    public PatientDeviceReadingService(
            PatientDeviceReadingJpaRepository readingRepository,
            UserJpaRepository userRepository
    ) {
        this.readingRepository = readingRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public PatientDeviceReadingResponse create(String actorUserId, PatientDeviceReadingCreateRequest request) {
        UserRole role = resolveRole(actorUserId);
        if (role != UserRole.PATIENT) {
            throw new SecurityException("Only patients can save device readings to their profile.");
        }
        String deviceKey = Objects.toString(request.deviceKey(), "").trim();
        String deviceType = Objects.toString(request.deviceType(), "").trim();
        if (deviceKey.isBlank() || deviceType.isBlank()) {
            throw new IllegalArgumentException("deviceKey and deviceType are required.");
        }
        Map<String, Object> measurements = request.measurements();
        if (measurements == null || measurements.isEmpty()) {
            throw new IllegalArgumentException("measurements are required.");
        }

        PatientDeviceReadingJpaEntity row = new PatientDeviceReadingJpaEntity();
        row.setPatientUserId(actorUserId);
        row.setDeviceKey(deviceKey);
        row.setDeviceName(trimToNull(request.deviceName()));
        row.setDeviceType(deviceType);
        row.setMeasurements(new LinkedHashMap<>(measurements));
        row.setRecordedAt(request.recordedAt() != null ? request.recordedAt() : Instant.now());
        row.setRawBytes(decodeRawBytes(request.rawBytesBase64()));
        row.setDeleted(false);

        PatientDeviceReadingJpaEntity saved = readingRepository.save(row);
        LOG.info(
                "patient_device_reading_saved deviceType={} deviceKey={}",
                deviceType,
                deviceKey
        );
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<PatientDeviceReadingResponse> listForActor(String actorUserId, Pageable pageable) {
        UserRole role = resolveRole(actorUserId);
        if (role != UserRole.PATIENT) {
            throw new SecurityException("Only patients can list their device readings.");
        }
        return readingRepository.findByPatientUserIdAndDeletedFalse(actorUserId, pageable)
                .map(this::toResponse);
    }

    private UserRole resolveRole(String actorUserId) {
        UserJpaEntity user = userRepository.findById(actorUserId).orElse(null);
        if (user == null || user.getRole() == null) {
            return UserRole.PATIENT;
        }
        return user.getRole();
    }

    private static String trimToNull(String value) {
        String s = Objects.toString(value, "").trim();
        return s.isBlank() ? null : s;
    }

    private static byte[] decodeRawBytes(String rawBytesBase64) {
        String encoded = Objects.toString(rawBytesBase64, "").trim();
        if (encoded.isBlank()) {
            return null;
        }
        try {
            return Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("rawBytesBase64 is not valid Base64.");
        }
    }

    private PatientDeviceReadingResponse toResponse(PatientDeviceReadingJpaEntity row) {
        return new PatientDeviceReadingResponse(
                row.getExternalId(),
                row.getDeviceKey(),
                row.getDeviceName(),
                row.getDeviceType(),
                row.getMeasurements(),
                row.getRecordedAt(),
                row.getCreatedAt()
        );
    }
}
