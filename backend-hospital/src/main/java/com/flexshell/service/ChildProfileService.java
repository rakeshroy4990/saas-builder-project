package com.flexshell.service;

import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.ChildProfileQueryDto;
import com.flexshell.controller.dto.ChildProfileResponse;
import com.flexshell.controller.dto.ChildProfileSaveRequest;
import com.flexshell.controller.dto.GrowthCharacteristicsDto;
import com.flexshell.controller.dto.GrowthChartContextResponse;
import com.flexshell.controller.dto.GrowthLatestSummaryDto;
import com.flexshell.controller.dto.GrowthRecordResponse;
import com.flexshell.controller.dto.PagedChildProfileListDto;
import com.flexshell.controller.dto.WhoPercentileCurvesDto;
import com.flexshell.growth.MidParentalHeightService;
import com.flexshell.growth.MidParentalHeightSupport;
import com.flexshell.growth.GrowthCharacteristicSupport;
import com.flexshell.growth.WhoGrowthMetric;
import com.flexshell.growth.WhoPercentileService;
import com.flexshell.i18n.HospitalMessageResolver;
import com.flexshell.persistence.postgres.model.ChildProfileJpaEntity;
import com.flexshell.persistence.postgres.model.GrowthRecordJpaEntity;
import com.flexshell.persistence.postgres.model.UserJpaEntity;
import com.flexshell.persistence.postgres.repository.AppointmentJpaRepository;
import com.flexshell.persistence.postgres.repository.ChildProfileJpaRepository;
import com.flexshell.persistence.postgres.repository.GrowthRecordJpaRepository;
import com.flexshell.persistence.postgres.repository.UserJpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChildProfileService {

    private static final Set<String> VALID_SEX = Set.of("male", "female");

    private final ChildProfileJpaRepository childProfileRepository;
    private final GrowthRecordJpaRepository growthRecordRepository;
    private final AppointmentJpaRepository appointmentRepository;
    private final UserJpaRepository userRepository;
    private final WhoPercentileService whoPercentileService;
    private final HospitalMessageResolver hospitalMessageResolver;
    private final MidParentalHeightService midParentalHeightService;

    public ChildProfileService(
            ChildProfileJpaRepository childProfileRepository,
            GrowthRecordJpaRepository growthRecordRepository,
            AppointmentJpaRepository appointmentRepository,
            UserJpaRepository userRepository,
            WhoPercentileService whoPercentileService,
            HospitalMessageResolver hospitalMessageResolver,
            MidParentalHeightService midParentalHeightService
    ) {
        this.childProfileRepository = childProfileRepository;
        this.growthRecordRepository = growthRecordRepository;
        this.appointmentRepository = appointmentRepository;
        this.userRepository = userRepository;
        this.whoPercentileService = whoPercentileService;
        this.hospitalMessageResolver = hospitalMessageResolver;
        this.midParentalHeightService = midParentalHeightService;
    }

    @Transactional(readOnly = true)
    public PagedChildProfileListDto listForActor(
            String actorUserId,
            int page,
            int size,
            ChildProfileQueryDto query
    ) {
        UserRole role = resolveRole(actorUserId);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.ASC, "displayName"));

        if (role == UserRole.PATIENT) {
            Page<ChildProfileJpaEntity> rows = listPatientChildren(actorUserId, query, pageable);
            return toPaged(rows);
        }
        if (role == UserRole.DOCTOR) {
            String patientUserId = query == null ? null : trimToNull(query.getPatientUserId());
            if (patientUserId == null) {
                throw new IllegalArgumentException("CHILD_PROFILE_PATIENT_USER_REQUIRED");
            }
            ensureDoctorPatientLink(actorUserId, patientUserId);
            Page<ChildProfileJpaEntity> rows = childProfileRepository.findByPatientUserIdAndDeletedFalse(patientUserId, pageable);
            return toPaged(rows);
        }
        if (role == UserRole.ADMIN) {
            String patientUserId = query == null ? null : trimToNull(query.getPatientUserId());
            if (patientUserId != null) {
                Page<ChildProfileJpaEntity> rows = childProfileRepository.findByPatientUserIdAndDeletedFalse(patientUserId, pageable);
                return toPaged(rows);
            }
            throw new IllegalArgumentException("CHILD_PROFILE_PATIENT_USER_REQUIRED");
        }
        throw new SecurityException("Forbidden");
    }

    private void ensureDoctorPatientLink(String doctorUserId, String patientUserId) {
        boolean linked = appointmentRepository.findByDoctorIdAndDeletedFalse(doctorUserId, Pageable.unpaged())
                .stream()
                .anyMatch(appt -> patientUserId.equals(normalize(appt.getCreatedBy())));
        if (!linked) {
            throw new SecurityException("Forbidden");
        }
    }

    @Transactional(readOnly = true)
    public ChildProfileResponse getForActor(String actorUserId, UUID externalId) {
        ChildProfileJpaEntity row = childProfileRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("CHILD_PROFILE_NOT_FOUND"));
        ensureCanRead(actorUserId, row);
        return toResponse(row);
    }

    @Transactional(readOnly = true)
    public GrowthChartContextResponse chartContext(
            String actorUserId,
            UUID childExternalId,
            String metricWire,
            int fromMonths,
            int toMonths,
            String localeCode
    ) {
        ChildProfileJpaEntity child = childProfileRepository.findByExternalIdAndDeletedFalse(childExternalId)
                .orElseThrow(() -> new IllegalArgumentException("CHILD_PROFILE_NOT_FOUND"));
        ensureCanRead(actorUserId, child);

        WhoGrowthMetric metric = WhoGrowthMetric.fromWire(metricWire);
        List<GrowthRecordResponse> records = growthRecordRepository
                .findByChildProfileExternalIdAndDeletedFalseOrderByRecordedAtAsc(childExternalId)
                .stream()
                .map(this::toGrowthResponse)
                .collect(Collectors.toList());

        WhoPercentileCurvesDto curves = whoPercentileService.getPercentileCurves(
                metric,
                child.getSex(),
                fromMonths,
                toMonths
        );

        GrowthChartContextResponse response = new GrowthChartContextResponse();
        response.setChildProfile(toResponse(child));
        response.setMetric(metric.wireKey());
        response.setRecords(records);
        response.setPercentileCurves(curves);
        response.setLatestSummary(buildLatestSummary(child, records, localeCode));

        Double latestAgeMonths = records.isEmpty()
                ? null
                : records.get(records.size() - 1).getAgeMonthsAtRecording().doubleValue();
        response.setMidParentalHeight(midParentalHeightService.compute(
                child.getSex(),
                child.getMotherHeightCm(),
                child.getFatherHeightCm(),
                latestAgeMonths
        ));
        return response;
    }

    @Transactional
    public ChildProfileResponse save(String actorUserId, ChildProfileSaveRequest request) {
        ensurePatient(actorUserId);
        if (request == null) {
            throw new IllegalArgumentException("CHILD_PROFILE_REQUEST_REQUIRED");
        }

        ChildProfileJpaEntity row;
        if (request.getExternalId() != null) {
            row = childProfileRepository.findByExternalIdAndDeletedFalse(request.getExternalId())
                    .orElseThrow(() -> new IllegalArgumentException("CHILD_PROFILE_NOT_FOUND"));
            if (!actorUserId.equals(row.getPatientUserId())) {
                throw new SecurityException("Forbidden");
            }
        } else {
            row = new ChildProfileJpaEntity();
            row.setPatientUserId(actorUserId);
            row.setDeleted(false);
        }

        if (request.getDisplayName() != null && !request.getDisplayName().isBlank()) {
            row.setDisplayName(request.getDisplayName().trim());
        } else if (row.getDisplayName() == null) {
            throw new IllegalArgumentException("CHILD_PROFILE_NAME_REQUIRED");
        }

        if (request.getDateOfBirth() != null) {
            row.setDateOfBirth(request.getDateOfBirth());
        } else if (row.getDateOfBirth() == null) {
            throw new IllegalArgumentException("CHILD_PROFILE_DOB_REQUIRED");
        }

        if (request.getSex() != null && !request.getSex().isBlank()) {
            String sex = normalizeSex(request.getSex());
            row.setSex(sex);
        } else if (row.getSex() == null) {
            throw new IllegalArgumentException("CHILD_PROFILE_SEX_REQUIRED");
        }

        if (request.getBloodGroup() != null) {
            row.setBloodGroup(trimToNull(request.getBloodGroup()));
        }

        if (request.getMotherHeightCm() != null) {
            validateParentHeight(request.getMotherHeightCm(), "CHILD_PROFILE_MOTHER_HEIGHT_INVALID");
            row.setMotherHeightCm(request.getMotherHeightCm());
        }
        if (request.getFatherHeightCm() != null) {
            validateParentHeight(request.getFatherHeightCm(), "CHILD_PROFILE_FATHER_HEIGHT_INVALID");
            row.setFatherHeightCm(request.getFatherHeightCm());
        }

        return toResponse(childProfileRepository.save(row));
    }

    @Transactional
    public void deleteByBusinessKey(String actorUserId, UUID externalId) {
        ensurePatient(actorUserId);
        ChildProfileJpaEntity row = childProfileRepository.findByExternalIdAndDeletedFalse(externalId)
                .orElseThrow(() -> new IllegalArgumentException("CHILD_PROFILE_NOT_FOUND"));
        if (!actorUserId.equals(row.getPatientUserId())) {
            throw new SecurityException("Forbidden");
        }
        row.setDeleted(true);
        childProfileRepository.save(row);
    }

    @Transactional(readOnly = true)
    public ChildProfileJpaEntity requireReadableChild(String actorUserId, UUID childExternalId) {
        ChildProfileJpaEntity child = childProfileRepository.findByExternalIdAndDeletedFalse(childExternalId)
                .orElseThrow(() -> new IllegalArgumentException("CHILD_PROFILE_NOT_FOUND"));
        ensureCanRead(actorUserId, child);
        return child;
    }

    static BigDecimal computeAgeMonths(LocalDate dateOfBirth, java.time.Instant recordedAt) {
        LocalDate recordedDate = recordedAt.atZone(ZoneOffset.UTC).toLocalDate();
        long days = ChronoUnit.DAYS.between(dateOfBirth, recordedDate);
        double months = days / 30.4375;
        return BigDecimal.valueOf(Math.max(0.0, months)).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private Page<ChildProfileJpaEntity> listPatientChildren(
            String patientUserId,
            ChildProfileQueryDto query,
            Pageable pageable
    ) {
        String name = query == null ? null : trimToNull(query.getDisplayName());
        if (name != null) {
            return childProfileRepository.findByPatientUserIdAndDisplayNameContainingIgnoreCaseAndDeletedFalse(
                    patientUserId,
                    name,
                    pageable
            );
        }
        return childProfileRepository.findByPatientUserIdAndDeletedFalse(patientUserId, pageable);
    }

    private void ensureCanRead(String actorUserId, ChildProfileJpaEntity child) {
        UserRole role = resolveRole(actorUserId);
        if (role == UserRole.PATIENT) {
            if (!actorUserId.equals(child.getPatientUserId())) {
                throw new SecurityException("Forbidden");
            }
            return;
        }
        if (role == UserRole.DOCTOR) {
            boolean linked = appointmentRepository.findByDoctorIdAndDeletedFalse(actorUserId, Pageable.unpaged())
                    .stream()
                    .anyMatch(appt -> child.getPatientUserId().equals(normalize(appt.getCreatedBy())));
            if (!linked) {
                throw new SecurityException("Forbidden");
            }
            return;
        }
        if (role == UserRole.ADMIN) {
            return;
        }
        throw new SecurityException("Forbidden");
    }

    private void ensurePatient(String actorUserId) {
        if (resolveRole(actorUserId) != UserRole.PATIENT) {
            throw new SecurityException("Only patients can manage child profiles.");
        }
    }

    private UserRole resolveRole(String actorUserId) {
        UserJpaEntity user = userRepository.findById(actorUserId).orElse(null);
        if (user == null || user.getRole() == null) {
            return UserRole.PATIENT;
        }
        return user.getRole();
    }

    private PagedChildProfileListDto toPaged(Page<ChildProfileJpaEntity> rows) {
        List<ChildProfileResponse> content = rows.getContent().stream().map(this::toResponse).collect(Collectors.toList());
        return new PagedChildProfileListDto(content, rows.getNumber(), rows.getSize(), rows.getTotalElements());
    }

    private ChildProfileResponse toResponse(ChildProfileJpaEntity row) {
        ChildProfileResponse response = new ChildProfileResponse();
        response.setExternalId(row.getExternalId());
        response.setDisplayName(row.getDisplayName());
        response.setDateOfBirth(row.getDateOfBirth());
        response.setSex(row.getSex());
        response.setBloodGroup(row.getBloodGroup());
        response.setMotherHeightCm(row.getMotherHeightCm());
        response.setFatherHeightCm(row.getFatherHeightCm());
        response.setCreatedAt(row.getCreatedAt());
        response.setUpdatedAt(row.getUpdatedAt());
        return response;
    }

    private GrowthRecordResponse toGrowthResponse(GrowthRecordJpaEntity row) {
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

    private GrowthLatestSummaryDto buildLatestSummary(
            ChildProfileJpaEntity child,
            List<GrowthRecordResponse> records,
            String localeCode
    ) {
        if (records.isEmpty()) {
            return null;
        }
        GrowthRecordResponse latest = records.get(records.size() - 1);
        GrowthLatestSummaryDto summary = new GrowthLatestSummaryDto();
        summary.setWeightPercentile(latest.getWeightPercentile());
        summary.setHeightPercentile(latest.getHeightPercentile());
        summary.setBmiPercentile(latest.getBmiPercentile());
        summary.setHcPercentile(latest.getHcPercentile());
        summary.setInterpretationBand(interpretBand(latest.getWeightPercentile()));
        String locale = normalizeLocaleCode(localeCode);
        GrowthCharacteristicsDto characteristics = GrowthCharacteristicSupport.derive(
                hospitalMessageResolver,
                locale,
                child.getSex(),
                latest.getWeightPercentile(),
                latest.getHeightPercentile(),
                latest.getBmiPercentile(),
                latest.getHcPercentile()
        );
        summary.setCharacteristics(characteristics);
        return summary;
    }

    private static String normalizeLocaleCode(String localeCode) {
        String raw = Objects.toString(localeCode, "en").trim().toLowerCase(Locale.ROOT);
        if (raw.isBlank()) {
            return "en";
        }
        int dash = raw.indexOf('-');
        return dash > 0 ? raw.substring(0, dash) : raw;
    }

    private static void validateParentHeight(BigDecimal heightCm, String errorCode) {
        if (heightCm == null || !MidParentalHeightSupport.isValidParentHeight(heightCm.doubleValue())) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    static String interpretBand(BigDecimal percentile) {
        if (percentile == null) {
            return "unknown";
        }
        double p = percentile.doubleValue();
        if (p < 3.0 || p > 97.0) {
            return "concerning";
        }
        if (p < 15.0 || p > 85.0) {
            return "watch";
        }
        return "normal";
    }

    private static String normalizeSex(String sex) {
        String normalized = sex.trim().toLowerCase(Locale.ROOT);
        if (!VALID_SEX.contains(normalized)) {
            throw new IllegalArgumentException("CHILD_PROFILE_SEX_INVALID");
        }
        return normalized;
    }

    private static String trimToNull(String value) {
        String s = Objects.toString(value, "").trim();
        return s.isBlank() ? null : s;
    }

    private static String normalize(String value) {
        return Objects.toString(value, "").trim();
    }
}
