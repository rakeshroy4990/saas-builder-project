package com.flexshell.service;

import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.GrowthRecordQueryDto;
import com.flexshell.controller.dto.GrowthRecordResponse;
import com.flexshell.controller.dto.GrowthRecordSaveRequest;
import com.flexshell.controller.dto.PagedGrowthRecordListDto;
import com.flexshell.growth.GrowthMeasurementValidator;
import com.flexshell.growth.WhoGrowthMetric;
import com.flexshell.growth.WhoPercentileService;
import com.flexshell.persistence.postgres.model.AppointmentJpaEntity;
import com.flexshell.persistence.postgres.model.ChildProfileJpaEntity;
import com.flexshell.persistence.postgres.model.GrowthRecordJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.GrowthRecordJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class GrowthRecordService {

    private static final Set<String> VALID_SOURCES = Set.of("manual", "ble_scale", "ble_imported", "clinic");

    private final GrowthRecordJpaRepository growthRecordRepository;
    private final ChildProfileService childProfileService;
    private final AppointmentJpaRepository appointmentRepository;
    private final UserJpaRepository userRepository;
    private final WhoPercentileService whoPercentileService;

    public GrowthRecordService(
            GrowthRecordJpaRepository growthRecordRepository,
            ChildProfileService childProfileService,
            AppointmentJpaRepository appointmentRepository,
            UserJpaRepository userRepository,
            WhoPercentileService whoPercentileService
    ) {
        this.growthRecordRepository = growthRecordRepository;
        this.childProfileService = childProfileService;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.whoPercentileService = whoPercentileService;
    }

    @Transactional(readOnly = true)
    public PagedGrowthRecordListDto listForActor(
            String actorUserId,
            int page,
            int size,
            GrowthRecordQueryDto query
    ) {
        UUID childId = query == null ? null : query.getChildProfileExternalId();
        if (childId == null) {
            throw new IllegalArgumentException("GROWTH_CHILD_PROFILE_REQUIRED");
        }
        childProfileService.requireReadableChild(actorUserId, childId);

        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.ASC, "recordedAt"));
        Page<GrowthRecordJpaEntity> rows = growthRecordRepository.findByChildProfileExternalIdAndDeletedFalse(childId, pageable);
        List<GrowthRecordResponse> content = rows.getContent().stream().map(this::toResponse).collect(Collectors.toList());
        return new PagedGrowthRecordListDto(content, rows.getNumber(), rows.getSize(), rows.getTotalElements());
    }

    @Transactional
    public GrowthRecordResponse save(String actorUserId, GrowthRecordSaveRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("GROWTH_RECORD_REQUEST_REQUIRED");
        }
        UUID childId = request.getChildProfileExternalId();
        if (childId == null) {
            throw new IllegalArgumentException("GROWTH_CHILD_PROFILE_REQUIRED");
        }

        ChildProfileJpaEntity child = childProfileService.requireReadableChild(actorUserId, childId);
        UserRole role = resolveRole(actorUserId);

        GrowthRecordJpaEntity row;
        if (request.getExternalId() != null) {
            if (role != UserRole.PATIENT) {
                throw new SecurityException("Only patients can update growth records.");
            }
            row = growthRecordRepository.findByExternalIdAndDeletedFalse(request.getExternalId())
                    .orElseThrow(() -> new IllegalArgumentException("GROWTH_RECORD_NOT_FOUND"));
            if (!childId.equals(row.getChildProfileExternalId())) {
                throw new SecurityException("Forbidden");
            }
        } else {
            if (role == UserRole.DOCTOR && request.getAppointmentExternalId() == null) {
                throw new IllegalArgumentException("GROWTH_APPOINTMENT_REQUIRED");
            }
            if (role != UserRole.PATIENT && role != UserRole.DOCTOR) {
                throw new SecurityException("Forbidden");
            }
            row = new GrowthRecordJpaEntity();
            row.setChildProfileExternalId(childId);
            row.setDeleted(false);
            row.setRecordedByUserId(actorUserId);
        }

        Instant recordedAt = request.getRecordedAt() != null ? request.getRecordedAt() : Instant.now();
        row.setRecordedAt(recordedAt);

        if (request.getHeightCm() != null) {
            GrowthMeasurementValidator.validateHeight(request.getHeightCm());
            row.setHeightCm(request.getHeightCm());
        }
        if (request.getWeightKg() != null) {
            GrowthMeasurementValidator.validateWeight(request.getWeightKg());
            row.setWeightKg(request.getWeightKg());
        }
        if (request.getHeadCircumferenceCm() != null) {
            GrowthMeasurementValidator.validateHeadCircumference(request.getHeadCircumferenceCm());
            row.setHeadCircumferenceCm(request.getHeadCircumferenceCm());
        }

        if (request.getSource() != null && !request.getSource().isBlank()) {
            String source = request.getSource().trim().toLowerCase();
            if (!VALID_SOURCES.contains(source)) {
                throw new IllegalArgumentException("GROWTH_SOURCE_INVALID");
            }
            row.setSource(source);
        } else if (row.getSource() == null) {
            row.setSource(role == UserRole.DOCTOR ? "clinic" : "manual");
        }

        if (request.getAppointmentExternalId() != null) {
            validateAppointmentLink(actorUserId, role, child, request.getAppointmentExternalId());
            row.setAppointmentExternalId(request.getAppointmentExternalId());
        }

        if (request.getDeviceReadingExternalId() != null) {
            row.setDeviceReadingExternalId(request.getDeviceReadingExternalId());
        }

        if (request.getNotes() != null) {
            row.setNotes(trimToNull(request.getNotes()));
        }

        boolean hasMeasurement = row.getHeightCm() != null || row.getWeightKg() != null || row.getHeadCircumferenceCm() != null;
        if (!hasMeasurement) {
            throw new IllegalArgumentException("GROWTH_MEASUREMENT_REQUIRED");
        }

        row.setAgeMonthsAtRecording(ChildProfileService.computeAgeMonths(child.getDateOfBirth(), recordedAt));
        row.setBmi(computeBmi(row.getWeightKg(), row.getHeightCm()));
        applyPercentiles(row, child.getSex());

        return toResponse(growthRecordRepository.save(row));
    }

    @Transactional
    public void deleteByBusinessKey(String actorUserId, UUID externalId) {
        if (resolveRole(actorUserId) != UserRole.PATIENT) {
            throw new SecurityException("Only patients can delete growth records.");
        }
        GrowthRecordJpaEntity row = growthRecordRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("GROWTH_RECORD_NOT_FOUND"));
        childProfileService.requireReadableChild(actorUserId, row.getChildProfileExternalId());
        row.setDeleted(true);
        growthRecordRepository.save(row);
    }

    private void validateAppointmentLink(
            String actorUserId,
            UserRole role,
            ChildProfileJpaEntity child,
            UUID appointmentExternalId
    ) {
        AppointmentJpaEntity appointment = appointmentRepository.findByExternalIdAndDeletedFalse(appointmentExternalId)
                .orElseThrow(() -> new IllegalArgumentException("APPOINTMENT_NOT_FOUND"));
        if (!child.getPatientUserId().equals(normalize(appointment.getCreatedBy()))) {
            throw new SecurityException("Appointment does not belong to this child.");
        }
        if (role == UserRole.DOCTOR && !actorUserId.equals(normalize(appointment.getDoctorId()))) {
            throw new SecurityException("Forbidden");
        }
        if (role == UserRole.PATIENT && !actorUserId.equals(child.getPatientUserId())) {
            throw new SecurityException("Forbidden");
        }
    }

    private void applyPercentiles(GrowthRecordJpaEntity row, String sex) {
        double ageMonths = row.getAgeMonthsAtRecording().doubleValue();
        if (row.getWeightKg() != null) {
            Double percentile = whoPercentileService.computePercentile(
                    WhoGrowthMetric.WFA,
                    sex,
                    ageMonths,
                    row.getWeightKg().doubleValue()
            );
            row.setWeightPercentile(toPercentileDecimal(percentile));
        }
        if (row.getHeightCm() != null) {
            Double percentile = whoPercentileService.computePercentile(
                    WhoGrowthMetric.LHFA,
                    sex,
                    ageMonths,
                    row.getHeightCm().doubleValue()
            );
            row.setHeightPercentile(toPercentileDecimal(percentile));
        }
        if (row.getBmi() != null) {
            Double percentile = whoPercentileService.computePercentile(
                    WhoGrowthMetric.BFA,
                    sex,
                    ageMonths,
                    row.getBmi().doubleValue()
            );
            row.setBmiPercentile(toPercentileDecimal(percentile));
        }
        if (row.getHeadCircumferenceCm() != null) {
            Double percentile = whoPercentileService.computePercentile(
                    WhoGrowthMetric.HCFA,
                    sex,
                    ageMonths,
                    row.getHeadCircumferenceCm().doubleValue()
            );
            row.setHcPercentile(toPercentileDecimal(percentile));
        }
    }

    private static BigDecimal computeBmi(BigDecimal weightKg, BigDecimal heightCm) {
        if (weightKg == null || heightCm == null || heightCm.doubleValue() <= 0.0) {
            return null;
        }
        double heightM = heightCm.doubleValue() / 100.0;
        double bmi = weightKg.doubleValue() / (heightM * heightM);
        return BigDecimal.valueOf(bmi).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal toPercentileDecimal(Double percentile) {
        if (percentile == null) {
            return null;
        }
        return BigDecimal.valueOf(percentile).setScale(2, RoundingMode.HALF_UP);
    }

    private UserRole resolveRole(String actorUserId) {
        UserJpaEntity user = userRepository.findById(actorUserId).orElse(null);
        if (user == null || user.getRole() == null) {
            return UserRole.PATIENT;
        }
        return user.getRole();
    }

    private GrowthRecordResponse toResponse(GrowthRecordJpaEntity row) {
        GrowthRecordResponse response = new GrowthRecordResponse();
        response.setExternalId(row.getExternalId());
        response.setChildProfileExternalId(row.getChildProfileExternalId());
        response.setRecordedAt(row.getRecordedAt());
        response.setRecordedByUserId(row.getRecordedByUserId());
        response.setAgeMonthsAtRecording(row.getAgeMonthsAtRecording());
        response.setHeightCm(row.getHeightCm());
        response.setWeightKg(row.getWeightKg());
        response.setHeadCircumferenceCm(row.getHeadCircumferenceCm());
        response.setBmi(row.getBmi());
        response.setHeightPercentile(row.getHeightPercentile());
        response.setWeightPercentile(row.getWeightPercentile());
        response.setBmiPercentile(row.getBmiPercentile());
        response.setHcPercentile(row.getHcPercentile());
        response.setSource(row.getSource());
        response.setAppointmentExternalId(row.getAppointmentExternalId());
        response.setDeviceReadingExternalId(row.getDeviceReadingExternalId());
        response.setNotes(row.getNotes());
        response.setCreatedAt(row.getCreatedAt());
        return response;
    }

    private static String trimToNull(String value) {
        String s = Objects.toString(value, "").trim();
        return s.isBlank() ? null : s;
    }

    private static String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
