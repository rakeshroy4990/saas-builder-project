package com.flexshell.service;

import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.PatientDeviceReadingCreateRequest;
import com.flexshell.controller.dto.PatientDeviceReadingQueryDto;
import com.flexshell.controller.dto.PatientDeviceReadingResponse;
import com.flexshell.controller.dto.PatientDeviceReadingSaveRequest;
import com.flexshell.controller.dto.SmartWatchSyncReadingItem;
import com.flexshell.controller.dto.SmartWatchSyncRequest;
import com.flexshell.controller.dto.SmartWatchSyncResponse;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.model.PatientDeviceReadingJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.PatientDeviceReadingJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Base64;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class PatientDeviceReadingService {

    private static final Logger LOG = LoggerFactory.getLogger(PatientDeviceReadingService.class);

    private final PatientDeviceReadingJpaRepository readingRepository;
    private final UserJpaRepository userRepository;
    private final AppointmentJpaRepository appointmentRepository;
    private final ChildProfileService childProfileService;

    public PatientDeviceReadingService(
            PatientDeviceReadingJpaRepository readingRepository,
            UserJpaRepository userRepository,
            AppointmentJpaRepository appointmentRepository,
            ChildProfileService childProfileService
    ) {
        this.readingRepository = readingRepository;
        this.userRepository = userRepository;
        this.appointmentRepository = appointmentRepository;
        this.childProfileService = childProfileService;
    }

    @Transactional
    public PatientDeviceReadingResponse create(String actorUserId, PatientDeviceReadingCreateRequest request) {
        UserRole role = resolveRole(actorUserId);
        String deviceKey = Objects.toString(request.deviceKey(), "").trim();
        String deviceType = Objects.toString(request.deviceType(), "").trim();
        if (deviceKey.isBlank() || deviceType.isBlank()) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_DEVICE_REQUIRED");
        }
        Map<String, Object> measurements = request.measurements();
        if (measurements == null || measurements.isEmpty()) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_MEASUREMENTS_REQUIRED");
        }

        String patientUserId = actorUserId;
        if (role == UserRole.DOCTOR) {
            if (request.appointmentExternalId() == null) {
                throw new IllegalArgumentException("PATIENT_DEVICE_READING_APPOINTMENT_REQUIRED");
            }
            AppointmentJpaEntity appointment = requireAppointmentForDoctor(actorUserId, request.appointmentExternalId());
            patientUserId = normalize(appointment.getCreatedBy());
        } else if (role != UserRole.PATIENT) {
            throw new SecurityException("Only patients or assigned doctors can save device readings.");
        }

        if (request.childProfileExternalId() != null) {
            childProfileService.requireReadableChild(actorUserId, request.childProfileExternalId());
        }

        PatientDeviceReadingJpaEntity row = new PatientDeviceReadingJpaEntity();
        row.setPatientUserId(patientUserId);
        row.setDeviceKey(deviceKey);
        row.setDeviceName(trimToNull(request.deviceName()));
        row.setDeviceType(deviceType);
        row.setMeasurements(new LinkedHashMap<>(measurements));
        row.setRecordedAt(request.recordedAt() != null ? request.recordedAt() : Instant.now());
        row.setRawBytes(decodeRawBytes(request.rawBytesBase64()));
        row.setChildProfileExternalId(request.childProfileExternalId());
        row.setAppointmentExternalId(request.appointmentExternalId());
        row.setRecordedByUserId(actorUserId);
        row.setDeleted(false);

        PatientDeviceReadingJpaEntity saved = readingRepository.save(row);
        LOG.info("patient_device_reading_saved deviceType={} deviceKey={}", deviceType, deviceKey);
        return toResponse(saved);
    }

    private static final int SMART_WATCH_SYNC_MAX_ROWS = 31;

    @Transactional
    public SmartWatchSyncResponse syncSmartWatch(String actorUserId, SmartWatchSyncRequest request) {
        if (resolveRole(actorUserId) != UserRole.PATIENT) {
            throw new SecurityException("Only patients can sync smart watch readings.");
        }
        if (request == null || request.readings() == null || request.readings().isEmpty()) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_MEASUREMENTS_REQUIRED");
        }
        String platform = Objects.toString(request.platform(), "").trim();
        if (platform.isBlank()) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_DEVICE_REQUIRED");
        }
        if (request.childProfileExternalId() != null) {
            childProfileService.requireReadableChild(actorUserId, request.childProfileExternalId());
        }

        String deviceKey = "SMART_WATCH_" + platform.toUpperCase().replace('-', '_');
        String deviceName = platform.replace('_', ' ');

        List<PatientDeviceReadingResponse> savedRows = new ArrayList<>();
        int count = 0;
        for (SmartWatchSyncReadingItem item : request.readings()) {
            if (count >= SMART_WATCH_SYNC_MAX_ROWS) {
                break;
            }
            Map<String, Object> measurements = item.measurements();
            if (measurements == null || measurements.isEmpty()) {
                continue;
            }
            PatientDeviceReadingJpaEntity row = new PatientDeviceReadingJpaEntity();
            row.setPatientUserId(actorUserId);
            row.setDeviceKey(deviceKey);
            row.setDeviceName(deviceName);
            row.setDeviceType("smart_watch");
            row.setMeasurements(new LinkedHashMap<>(measurements));
            row.setRecordedAt(item.recordedAt() != null ? item.recordedAt() : Instant.now());
            row.setChildProfileExternalId(request.childProfileExternalId());
            row.setRecordedByUserId(actorUserId);
            row.setDeleted(false);
            savedRows.add(toResponse(readingRepository.save(row)));
            count++;
        }
        if (savedRows.isEmpty()) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_MEASUREMENTS_REQUIRED");
        }
        LOG.info("smart_watch_sync_saved platform={} count={}", platform, savedRows.size());
        return new SmartWatchSyncResponse(savedRows.size(), savedRows);
    }

    @Transactional
    public PatientDeviceReadingResponse save(String actorUserId, PatientDeviceReadingSaveRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_REQUEST_REQUIRED");
        }
        if (request.getExternalId() != null) {
            return update(actorUserId, request);
        }
        return create(actorUserId, request.toCreateRequest());
    }

    @Transactional
    public void deleteByBusinessKey(String actorUserId, UUID externalId) {
        if (resolveRole(actorUserId) != UserRole.PATIENT) {
            throw new SecurityException("Only patients can delete their device readings.");
        }
        if (externalId == null) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_EXTERNAL_ID_REQUIRED");
        }
        PatientDeviceReadingJpaEntity row = readingRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("PATIENT_DEVICE_READING_NOT_FOUND"));
        if (!actorUserId.equals(row.getPatientUserId())) {
            throw new SecurityException("Forbidden");
        }
        row.setDeleted(true);
        readingRepository.save(row);
    }

    @Transactional
    PatientDeviceReadingResponse update(String actorUserId, PatientDeviceReadingSaveRequest request) {
        if (resolveRole(actorUserId) != UserRole.PATIENT) {
            throw new SecurityException("Only patients can save device readings to their profile.");
        }
        UUID externalId = request.getExternalId();
        PatientDeviceReadingJpaEntity row = readingRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("PATIENT_DEVICE_READING_NOT_FOUND"));
        if (!actorUserId.equals(row.getPatientUserId())) {
            throw new SecurityException("Forbidden");
        }
        applySaveFields(row, request);
        return toResponse(readingRepository.save(row));
    }

    @Transactional(readOnly = true)
    public Page<PatientDeviceReadingResponse> listForActor(
            String actorUserId,
            Pageable pageable,
            PatientDeviceReadingQueryDto query
    ) {
        UserRole role = resolveRole(actorUserId);
        PatientDeviceReadingQueryDto safeQuery = query == null ? new PatientDeviceReadingQueryDto() : query;

        if (role == UserRole.PATIENT) {
            if (safeQuery.getChildProfileExternalId() != null) {
                childProfileService.requireReadableChild(actorUserId, safeQuery.getChildProfileExternalId());
                return readingRepository
                        .findByChildProfileExternalIdAndDeletedFalse(safeQuery.getChildProfileExternalId(), pageable)
                        .map(this::toResponse);
            }
            if (safeQuery.getDeviceType() != null && !safeQuery.getDeviceType().isBlank()) {
                return readingRepository
                        .findByPatientUserIdAndDeviceTypeAndDeletedFalse(
                                actorUserId,
                                safeQuery.getDeviceType().trim(),
                                pageable
                        )
                        .map(this::toResponse);
            }
            return readingRepository.findByPatientUserIdAndDeletedFalse(actorUserId, pageable)
                    .map(this::toResponse);
        }

        if (role == UserRole.DOCTOR || role == UserRole.ADMIN) {
            if (safeQuery.getChildProfileExternalId() != null) {
                childProfileService.requireReadableChild(actorUserId, safeQuery.getChildProfileExternalId());
                return readingRepository
                        .findByChildProfileExternalIdAndDeletedFalse(safeQuery.getChildProfileExternalId(), pageable)
                        .map(this::toResponse);
            }
            String patientUserId = trimToNull(safeQuery.getPatientUserId());
            if (patientUserId != null && role == UserRole.DOCTOR) {
                ensureDoctorPatientLink(actorUserId, patientUserId);
            }
            if (patientUserId != null && safeQuery.getDeviceType() != null && !safeQuery.getDeviceType().isBlank()) {
                return readingRepository
                        .findByPatientUserIdAndDeviceTypeAndDeletedFalse(
                                patientUserId,
                                safeQuery.getDeviceType().trim(),
                                pageable
                        )
                        .map(this::toResponse);
            }
            if (patientUserId != null) {
                return readingRepository.findByPatientUserIdAndDeletedFalse(patientUserId, pageable)
                        .map(this::toResponse);
            }
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_QUERY_REQUIRED");
        }

        throw new SecurityException("Forbidden");
    }

    private void applySaveFields(PatientDeviceReadingJpaEntity row, PatientDeviceReadingSaveRequest request) {
        if (request.getDeviceKey() != null && !request.getDeviceKey().isBlank()) {
            row.setDeviceKey(request.getDeviceKey().trim());
        }
        if (request.getDeviceName() != null) {
            row.setDeviceName(trimToNull(request.getDeviceName()));
        }
        if (request.getDeviceType() != null && !request.getDeviceType().isBlank()) {
            row.setDeviceType(request.getDeviceType().trim());
        }
        if (request.getMeasurements() != null && !request.getMeasurements().isEmpty()) {
            row.setMeasurements(new LinkedHashMap<>(request.getMeasurements()));
        }
        if (request.getRecordedAt() != null) {
            row.setRecordedAt(request.getRecordedAt());
        }
        if (request.getRawBytesBase64() != null) {
            row.setRawBytes(decodeRawBytes(request.getRawBytesBase64()));
        }
        if (request.getChildProfileExternalId() != null) {
            row.setChildProfileExternalId(request.getChildProfileExternalId());
        }
        if (request.getAppointmentExternalId() != null) {
            row.setAppointmentExternalId(request.getAppointmentExternalId());
        }
    }

    private AppointmentJpaEntity requireAppointmentForDoctor(String doctorUserId, UUID appointmentExternalId) {
        AppointmentJpaEntity appointment = appointmentRepository.findByExternalIdAndDeletedFalse(appointmentExternalId)
                .orElseThrow(() -> new IllegalArgumentException("APPOINTMENT_NOT_FOUND"));
        if (!doctorUserId.equals(normalize(appointment.getDoctorId()))) {
            throw new SecurityException("Forbidden");
        }
        return appointment;
    }

    private void ensureDoctorPatientLink(String doctorUserId, String patientUserId) {
        boolean linked = appointmentRepository.findByDoctorIdAndDeletedFalse(doctorUserId, Pageable.unpaged())
                .stream()
                .anyMatch(appt -> patientUserId.equals(normalize(appt.getCreatedBy())));
        if (!linked) {
            throw new SecurityException("Forbidden");
        }
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

    private static String normalize(String value) {
        return Objects.toString(value, "").trim();
    }

    private static byte[] decodeRawBytes(String rawBytesBase64) {
        String encoded = Objects.toString(rawBytesBase64, "").trim();
        if (encoded.isBlank()) {
            return null;
        }
        try {
            return Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("PATIENT_DEVICE_READING_INVALID_BASE64");
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
                row.getCreatedAt(),
                row.getChildProfileExternalId(),
                row.getAppointmentExternalId()
        );
    }
}
