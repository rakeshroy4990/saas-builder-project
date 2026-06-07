package com.flexshell.service;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.AppointmentAccess;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.email.AppointmentCreatedEmailNotifier;
import com.flexshell.email.AppointmentEmailNotifyOutcome;
import com.flexshell.extension.ExtensionContext;
import com.flexshell.extension.ExtensionHookInvoker;
import com.flexshell.observability.ObservabilityLogger;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.AppointmentFileResponse;
import com.flexshell.controller.dto.AppointmentRequest;
import com.flexshell.controller.dto.AppointmentResponse;
import com.flexshell.controller.dto.AvailableSlotDto;
import com.flexshell.controller.dto.AvailableSlotsResponse;
import com.flexshell.controller.dto.BookingDateAvailabilityDayDto;
import com.flexshell.controller.dto.BookingDateAvailabilityResponse;
import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.persistence.api.DoctorScheduleAccess;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.flexshell.controller.dto.AppointmentQueryDto;
import com.flexshell.controller.dto.AppointmentSaveRequest;
import com.flexshell.controller.dto.PagedAppointmentListDto;
import com.flexshell.controller.support.EntityQuerySupport;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class AppointmentService {
    private static final Logger log = LoggerFactory.getLogger(AppointmentService.class);
    private static final String DEFAULT_STATUS_OPEN = "Open";
    private static final String EMAIL_NOTIFY_STATUS_PENDING = "PENDING";
    private static final String STATUS_CANCELLED = "CANCELLED";
    private static final String STATUS_COMPLETED = "COMPLETED";
    /** Admin-only soft removal from operational views; document stays in Mongo. */
    public static final String STATUS_DELETED = "DELETED";
    private static final int BOOKING_DATE_AVAILABILITY_DEFAULT_DAYS = 10;
    private static final int BOOKING_DATE_AVAILABILITY_MAX_DAYS = 31;
    private final ObjectProvider<AppointmentAccess> appointmentAccessProvider;
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final ObjectProvider<DoctorScheduleAccess> doctorScheduleAccessProvider;
    private final ZoneId hospitalZoneId;
    private final AppointmentCreatedEmailNotifier appointmentCreatedEmailNotifier;
    private final ExtensionHookInvoker extensionHookInvoker;
    private final ObjectMapper objectMapper;

    public AppointmentService(
            ObjectProvider<AppointmentAccess> appointmentAccessProvider,
            ObjectProvider<UserAccess> userAccessProvider,
            ObjectProvider<DoctorScheduleAccess> doctorScheduleAccessProvider,
            @Qualifier("hospitalZoneId") ZoneId hospitalZoneId,
            AppointmentCreatedEmailNotifier appointmentCreatedEmailNotifier,
            ExtensionHookInvoker extensionHookInvoker,
            ObjectMapper objectMapper
    ) {
        this.appointmentAccessProvider = appointmentAccessProvider;
        this.userAccessProvider = userAccessProvider;
        this.doctorScheduleAccessProvider = doctorScheduleAccessProvider;
        this.hospitalZoneId = hospitalZoneId;
        this.appointmentCreatedEmailNotifier = appointmentCreatedEmailNotifier;
        this.extensionHookInvoker = extensionHookInvoker;
        this.objectMapper = objectMapper;
    }

    public AppointmentResponse create(AppointmentRequest request, List<MultipartFile> prescriptionFiles, String actorUserId) {
        AppointmentRequest effectiveRequest = runAppointmentCreateBeforeHooks(request, actorUserId);
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = new AppointmentEntity();
        applyRequest(entity, effectiveRequest, prescriptionFiles);
        assertPreferredSlotAllowed(
                normalize(entity.getDoctorId()),
                normalize(entity.getPreferredDate()),
                normalize(entity.getPreferredTimeSlot()));
        assertNoActiveSlotConflict(
                normalize(entity.getDoctorId()),
                normalize(entity.getPreferredDate()),
                normalize(entity.getPreferredTimeSlot()),
                null);
        Instant now = Instant.now();
        entity.setCreatedTimestamp(now);
        entity.setUpdatedTimestamp(now);
        entity.setCreatedBy(actorUserId);
        entity.setUpdatedBy(actorUserId);
        entity.setStatus(DEFAULT_STATUS_OPEN);
        entity.setDoctorName(resolveDoctorName(entity.getDoctorId()));
        // Persist initial email-notify tracking on first write so fields are present even
        // if post-notify status update cannot be saved.
        entity.setAppointmentEmailNotifyStatus(EMAIL_NOTIFY_STATUS_PENDING);
        entity.setAppointmentEmailNotifyFailed(Boolean.FALSE);
        entity.setAppointmentEmailNotifyDetail(null);
        entity.setAppointmentEmailNotifyAt(null);
        AppointmentEntity saved = repository.save(entity);
        ObservabilityLogger.info(log, "appointment_create", java.util.Map.of(
                "domain", "appointment",
                "status", "success",
                "reason_code", "create_success",
                "appointment_id", saved.getId(),
                "doctor_id", normalize(saved.getDoctorId())));
        AppointmentResponse draftResponse = toResponse(saved);
        AppointmentEmailNotifyOutcome emailOutcome = appointmentCreatedEmailNotifier.notifyAppointmentCreated(
                draftResponse,
                resolveDoctorEmail(saved.getDoctorId()));
        applyEmailNotifyOutcome(saved, emailOutcome);
        try {
            repository.save(saved);
        } catch (Exception ex) {
            // Appointment is already persisted; do not fail the create API if only email-status write fails.
            log.warn("Could not persist appointment email notification status: {}", ex.getMessage());
            ObservabilityLogger.warn(log, "appointment_create", java.util.Map.of(
                    "domain", "appointment",
                    "status", "fail",
                    "reason_code", "notification_failed",
                    "appointment_id", saved.getId()));
        }
        AppointmentResponse response = toResponse(saved);
        runAppointmentCreateAfterHooks(response, actorUserId);
        return response;
    }

    private AppointmentRequest runAppointmentCreateBeforeHooks(AppointmentRequest request, String actorUserId) {
        String endpoint = "POST /api/appointment/create";
        ExtensionContext context = ExtensionContext.of(actorUserId, "", "", "");
        Map<String, Object> payload = objectMapper.convertValue(request, new TypeReference<Map<String, Object>>() {});
        Map<String, Object> updated = extensionHookInvoker.runBefore(endpoint, payload, context);
        return objectMapper.convertValue(updated, AppointmentRequest.class);
    }

    private void runAppointmentCreateAfterHooks(AppointmentResponse response, String actorUserId) {
        String endpoint = "POST /api/appointment/create";
        ExtensionContext context = ExtensionContext.of(actorUserId, "", "", "");
        Map<String, Object> payload = objectMapper.convertValue(response, new TypeReference<Map<String, Object>>() {});
        extensionHookInvoker.runAfter(endpoint, payload, context);
    }

    public AppointmentResponse update(String id, AppointmentRequest request, List<MultipartFile> prescriptionFiles, String actorUserId) {
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        applyRequest(entity, request, prescriptionFiles);
        assertPreferredSlotAllowed(
                normalize(entity.getDoctorId()),
                normalize(entity.getPreferredDate()),
                normalize(entity.getPreferredTimeSlot()));
        assertNoActiveSlotConflict(
                normalize(entity.getDoctorId()),
                normalize(entity.getPreferredDate()),
                normalize(entity.getPreferredTimeSlot()),
                id);
        entity.setDoctorName(resolveDoctorName(entity.getDoctorId()));
        entity.setUpdatedTimestamp(Instant.now());
        entity.setUpdatedBy(actorUserId);
        AppointmentEntity saved = repository.save(entity);
        return toResponse(saved);
    }

    public boolean delete(String id, String actorUserId) {
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        repository.deleteById(id);
        return true;
    }

    /** Soft cancel: sets status to CANCELLED instead of removing the document. */
    public AppointmentResponse cancel(String id, String actorUserId) {
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        if (STATUS_CANCELLED.equalsIgnoreCase(normalize(entity.getStatus()))) {
            return toResponse(entity);
        }
        entity.setStatus(STATUS_CANCELLED);
        entity.setUpdatedTimestamp(Instant.now());
        entity.setUpdatedBy(actorUserId);
        AppointmentEntity saved = repository.save(entity);
        return toResponse(saved);
    }

    /**
     * Marks a consultation as completed so the assigned doctor can issue a structured e-prescription.
     * Only the assigned doctor may complete (patients and admins use other flows).
     */
    public AppointmentResponse completeVisit(String id, String actorUserId) {
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        UserRole role = resolveUserRole(actorUserId);
        if (role != UserRole.DOCTOR) {
            throw new SecurityException("Only the treating doctor can mark this visit complete");
        }
        String doctorId = normalize(entity.getDoctorId());
        if (!doctorId.equalsIgnoreCase(normalize(actorUserId))) {
            throw new SecurityException("Only the assigned doctor can mark this visit complete");
        }
        if (STATUS_CANCELLED.equalsIgnoreCase(normalize(entity.getStatus()))) {
            throw new IllegalArgumentException("Cancelled appointments cannot be completed");
        }
        if (STATUS_COMPLETED.equalsIgnoreCase(normalize(entity.getStatus()))) {
            return toResponse(entity);
        }
        entity.setStatus(STATUS_COMPLETED);
        entity.setUpdatedTimestamp(Instant.now());
        entity.setUpdatedBy(actorUserId);
        return toResponse(repository.save(entity));
    }

    public AppointmentEntity requireAppointmentEntity(String id, String actorUserId) {
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        return entity;
    }

    public AppointmentResponse getById(String id, String actorUserId) {
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        return toResponse(entity);
    }

    public List<AppointmentResponse> getAll(String actorUserId, int page, int size) {
        return listPaged(actorUserId, page, size, new AppointmentQueryDto()).getContent();
    }

    /**
     * Business key: appointment {@code id} (String).
     */
    public PagedAppointmentListDto listPaged(String actorUserId, int page, int size, AppointmentQueryDto query) {
        AppointmentAccess repository = requireAppointmentAccess();
        int safePage = EntityQuerySupport.safePage(page);
        int safeSize = EntityQuerySupport.safeSize(size);
        PageRequest pageRequest = PageRequest.of(0, Integer.MAX_VALUE, Sort.by(Sort.Direction.DESC, "createdTimestamp"));
        UserRole actorRole = resolveUserRole(actorUserId);
        Page<AppointmentEntity> result;
        if (actorRole == UserRole.DOCTOR) {
            result = repository.findByDoctorId(actorUserId, pageRequest);
        } else if (actorRole == UserRole.ADMIN) {
            result = repository.findAll(pageRequest);
        } else {
            result = repository.findByCreatedBy(actorUserId, pageRequest);
        }
        List<AppointmentEntity> filtered = result.stream()
                .filter(entity -> matchesQuery(entity, query))
                .toList();
        int total = filtered.size();
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        List<AppointmentResponse> content = filtered.subList(from, to).stream().map(this::toResponse).toList();
        int totalPages = safeSize == 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        return new PagedAppointmentListDto(content, total, totalPages, safePage, safeSize);
    }

    public AppointmentResponse saveOrUpdate(AppointmentSaveRequest request, String actorUserId) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        String id = request.getId() == null ? "" : request.getId().trim();
        if (id.isBlank()) {
            return create(request, List.of(), actorUserId);
        }
        return update(id, request, List.of(), actorUserId);
    }

    private static boolean matchesQuery(AppointmentEntity entity, AppointmentQueryDto query) {
        if (query == null) {
            return true;
        }
        String doctorId = query.getDoctorId();
        if (doctorId != null && !doctorId.isBlank()
                && (entity.getDoctorId() == null || !entity.getDoctorId().equalsIgnoreCase(doctorId.trim()))) {
            return false;
        }
        String status = query.getStatus();
        if (status != null && !status.isBlank()
                && (entity.getStatus() == null || !entity.getStatus().equalsIgnoreCase(status.trim()))) {
            return false;
        }
        String preferredDate = query.getPreferredDate();
        if (preferredDate != null && !preferredDate.isBlank()
                && (entity.getPreferredDate() == null || !entity.getPreferredDate().equalsIgnoreCase(preferredDate.trim()))) {
            return false;
        }
        String department = query.getDepartment();
        if (department != null && !department.isBlank()) {
            String entityDepartment = entity.getDepartment() == null ? "" : entity.getDepartment().trim();
            if (!entityDepartment.equalsIgnoreCase(department.trim())) {
                return false;
            }
        }
        if (Boolean.TRUE.equals(query.getUpcomingOnly()) && !isUpcomingAppointment(entity)) {
            return false;
        }
        String patientName = query.getPatientName();
        if (patientName != null && !patientName.isBlank()) {
            String hay = entity.getPatientName() == null ? "" : entity.getPatientName().toLowerCase();
            if (!hay.contains(patientName.trim().toLowerCase())) {
                return false;
            }
        }
        return true;
    }

    private static boolean isUpcomingAppointment(AppointmentEntity entity) {
        String preferredDate = entity.getPreferredDate();
        if (preferredDate == null || preferredDate.isBlank()) {
            return true;
        }
        String datePart = preferredDate.trim().length() >= 10
                ? preferredDate.trim().substring(0, 10)
                : preferredDate.trim();
        Long startMs = parseAppointmentStartEpochMs(datePart, entity.getPreferredTimeSlot());
        if (startMs != null) {
            return startMs >= System.currentTimeMillis();
        }
        try {
            java.time.LocalDate rowDate = java.time.LocalDate.parse(datePart);
            java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.systemDefault());
            return !rowDate.isBefore(today);
        } catch (java.time.format.DateTimeParseException ex) {
            return true;
        }
    }

    private static Long parseAppointmentStartEpochMs(String preferredDate, String preferredTimeSlot) {
        if (preferredDate == null || preferredDate.isBlank()
                || preferredTimeSlot == null || preferredTimeSlot.isBlank()) {
            return null;
        }
        String firstToken = preferredTimeSlot.trim().split("(?i)\\s*(?:-|–|—|\\bto\\b)\\s*")[0].trim();
        Integer minutes = parseTimeToMinutes(firstToken);
        if (minutes == null) {
            return null;
        }
        try {
            java.time.LocalDate date = java.time.LocalDate.parse(preferredDate.trim().substring(0, Math.min(10, preferredDate.trim().length())));
            java.time.LocalDateTime dateTime = date.atStartOfDay().plusMinutes(minutes);
            return dateTime.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static Integer parseTimeToMinutes(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String text = raw.trim();
        java.util.regex.Matcher twentyFour = java.util.regex.Pattern.compile("^(\\d{1,2}):(\\d{2})$").matcher(text);
        if (twentyFour.matches()) {
            int hh = Integer.parseInt(twentyFour.group(1));
            int mm = Integer.parseInt(twentyFour.group(2));
            if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
                return hh * 60 + mm;
            }
            return null;
        }
        java.util.regex.Matcher twelveHour = java.util.regex.Pattern.compile("^(\\d{1,2}):(\\d{2})\\s*([AaPp][Mm])$").matcher(text);
        if (!twelveHour.matches()) {
            return null;
        }
        int hh = Integer.parseInt(twelveHour.group(1));
        int mm = Integer.parseInt(twelveHour.group(2));
        String meridiem = twelveHour.group(3).toUpperCase();
        if (hh < 1 || hh > 12 || mm < 0 || mm > 59) {
            return null;
        }
        if ("AM".equals(meridiem)) {
            if (hh == 12) {
                hh = 0;
            }
        } else if (hh != 12) {
            hh += 12;
        }
        return hh * 60 + mm;
    }

    /**
     * Paginated list of all appointments (admin dashboard). Newest first.
     */
    public PagedAppointmentListDto listAllAppointmentsPagedForAdmin(String adminUserId, int page, int size) {
        UserAccess users = requireUserAccess();
        AdminAuthorizationSupport.requireAdminUser(users, adminUserId);
        AppointmentAccess repository = requireAppointmentAccess();
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? 20 : Math.min(size, 200);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdTimestamp"));
        Page<AppointmentEntity> result = repository.findAll(pageRequest);
        List<AppointmentResponse> list = result.stream().map(this::toResponse).toList();
        return new PagedAppointmentListDto(
                list,
                result.getTotalElements(),
                result.getTotalPages(),
                result.getNumber(),
                result.getSize());
    }

    /**
     * Marks an appointment as DELETED (admin-only); does not remove the document.
     */
    public AppointmentResponse softDeleteAppointmentAsAdmin(String appointmentId, String adminUserId) {
        UserAccess users = requireUserAccess();
        AdminAuthorizationSupport.requireAdminUser(users, adminUserId);
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        if (STATUS_DELETED.equalsIgnoreCase(normalize(entity.getStatus()))) {
            return toResponse(entity);
        }
        entity.setStatus(STATUS_DELETED);
        entity.setUpdatedTimestamp(Instant.now());
        entity.setUpdatedBy(adminUserId);
        return toResponse(repository.save(entity));
    }

    public List<String> listOccupiedTimeSlots(String doctorId, String preferredDate, String excludeAppointmentId, String actorUserId) {
        String docId = normalize(doctorId);
        String date = normalize(preferredDate);
        if (docId.isBlank() || date.isBlank()) {
            return List.of();
        }
        ensureActorCanQueryDoctorOccupiedSlots(actorUserId, docId);
        if (isGridDateBeforeToday(date)) {
            return List.of();
        }
        String exclude = normalize(excludeAppointmentId);
        AppointmentAccess repository = requireAppointmentAccess();
        List<AppointmentEntity> rows = repository.findByDoctorIdAndPreferredDate(docId, date);
        Set<String> slots = new LinkedHashSet<>();
        for (AppointmentEntity row : rows) {
            if (!exclude.isBlank() && exclude.equals(row.getId())) {
                continue;
            }
            if (!isOpenAppointmentBlockingSlot(row)) {
                continue;
            }
            String slot = normalize(row.getPreferredTimeSlot());
            if (!slot.isBlank()) {
                slots.add(slot);
            }
        }
        return new ArrayList<>(slots);
    }

    /**
     * Booking UI: schedule-based slots minus slots held by open appointments on that day.
     * Same rules as {@link #listAvailableTimeSlots}; exposed on a dedicated path for the book flow.
     */
    public AvailableSlotsResponse listBookingAvailableTimeSlots(
            String doctorId,
            String preferredDate,
            String excludeAppointmentId,
            String actorUserId
    ) {
        return listAvailableTimeSlots(doctorId, preferredDate, excludeAppointmentId, actorUserId);
    }

    /**
     * Booking calendar: slot counts for each day in a lookahead window (one DB round-trip for occupied slots).
     */
    public BookingDateAvailabilityResponse listBookingDateAvailability(
            String doctorId,
            int lookaheadDays,
            String excludeAppointmentId,
            String actorUserId
    ) {
        String docId = normalize(doctorId);
        if (docId.isBlank()) {
            return new BookingDateAvailabilityResponse(false, List.of());
        }
        ensureActorCanQueryDoctorOccupiedSlots(actorUserId, docId);
        int safeDays = lookaheadDays <= 0
                ? BOOKING_DATE_AVAILABILITY_DEFAULT_DAYS
                : Math.min(lookaheadDays, BOOKING_DATE_AVAILABILITY_MAX_DAYS);

        LocalDate start = LocalDate.now();
        LocalDate end = start.plusDays(safeDays - 1L);
        String fromIso = start.toString();
        String toIso = end.toString();

        boolean usesSchedule = false;
        Optional<DoctorScheduleEntity> scheduleOpt = Optional.empty();
        DoctorScheduleAccess scheduleAccess = doctorScheduleAccessProvider.getIfAvailable();
        if (scheduleAccess != null) {
            scheduleOpt = scheduleAccess.findByDoctorId(docId);
            if (scheduleOpt.isPresent() && DoctorSlotGenerator.scheduleHasEnabledWorkingDay(scheduleOpt.get())) {
                usesSchedule = true;
            }
        }

        String exclude = normalize(excludeAppointmentId);
        AppointmentAccess repository = requireAppointmentAccess();
        List<AppointmentEntity> rowsInRange = repository.findByDoctorIdAndPreferredDateBetween(docId, fromIso, toIso);
        Map<String, Set<String>> occupiedByDate = new HashMap<>();
        for (AppointmentEntity row : rowsInRange) {
            if (!exclude.isBlank() && exclude.equals(row.getId())) {
                continue;
            }
            if (!isOpenAppointmentBlockingSlot(row)) {
                continue;
            }
            String dateKey = preferredDateKey(row.getPreferredDate());
            if (dateKey.isBlank()) {
                continue;
            }
            String slot = normalize(row.getPreferredTimeSlot());
            if (slot.isBlank()) {
                continue;
            }
            occupiedByDate.computeIfAbsent(dateKey, ignored -> new LinkedHashSet<>()).add(slot);
        }

        String todayIso = start.toString();
        LocalTime nowLocal = LocalTime.now(hospitalZoneId);
        int nowMinutes = nowLocal.getHour() * 60 + nowLocal.getMinute();

        List<BookingDateAvailabilityDayDto> days = new ArrayList<>();
        for (int offset = 0; offset < safeDays; offset += 1) {
            LocalDate day = start.plusDays(offset);
            String iso = day.toString();
            List<String> base;
            if (usesSchedule && scheduleOpt.isPresent()) {
                base = DoctorSlotGenerator.generateSlotValues(day, hospitalZoneId, scheduleOpt.get());
            } else {
                base = new ArrayList<>(LegacySlotCatalog.slotValues());
            }
            Set<String> occupied = occupiedByDate.getOrDefault(iso, Set.of());
            int count = countUnblockedSlots(base, occupied, iso, todayIso, nowMinutes);
            days.add(new BookingDateAvailabilityDayDto(iso, count));
        }
        return new BookingDateAvailabilityResponse(usesSchedule, days);
    }

    public AvailableSlotsResponse listAvailableTimeSlots(
            String doctorId,
            String preferredDate,
            String excludeAppointmentId,
            String actorUserId
    ) {
        String docId = normalize(doctorId);
        String date = normalize(preferredDate);
        if (docId.isBlank() || date.isBlank()) {
            return new AvailableSlotsResponse(false, List.of());
        }
        ensureActorCanQueryDoctorOccupiedSlots(actorUserId, docId);
        if (isGridDateBeforeToday(date)) {
            return new AvailableSlotsResponse(false, List.of());
        }
        LocalDate d = parseIsoLocalDate(date);
        if (d == null) {
            return new AvailableSlotsResponse(false, List.of());
        }
        List<String> base;
        boolean usesSchedule = false;
        DoctorScheduleAccess scheduleAccess = doctorScheduleAccessProvider.getIfAvailable();
        if (scheduleAccess != null) {
            Optional<DoctorScheduleEntity> schOpt = scheduleAccess.findByDoctorId(docId);
            if (schOpt.isPresent() && DoctorSlotGenerator.scheduleHasEnabledWorkingDay(schOpt.get())) {
                usesSchedule = true;
                base = DoctorSlotGenerator.generateSlotValues(d, hospitalZoneId, schOpt.get());
            } else {
                base = new ArrayList<>(LegacySlotCatalog.slotValues());
            }
        } else {
            base = new ArrayList<>(LegacySlotCatalog.slotValues());
        }
        Set<String> occupied = new LinkedHashSet<>(
                listOccupiedTimeSlots(docId, date, excludeAppointmentId, actorUserId));
        List<AvailableSlotDto> slots = new ArrayList<>();
        for (String value : base) {
            if (!occupied.contains(value)) {
                slots.add(new AvailableSlotDto(value, DoctorSlotGenerator.formatLabel(value)));
            }
        }
        return new AvailableSlotsResponse(usesSchedule, slots);
    }

    private void assertPreferredSlotAllowed(String doctorId, String preferredDate, String preferredTimeSlot) {
        if (doctorId.isBlank() || preferredDate.isBlank() || preferredTimeSlot.isBlank()) {
            return;
        }
        LocalDate d = parseIsoLocalDate(preferredDate);
        if (d == null) {
            throw new IllegalArgumentException("PreferredDate is invalid");
        }
        List<String> allowed;
        boolean usesSchedule = false;
        DoctorScheduleAccess scheduleAccess = doctorScheduleAccessProvider.getIfAvailable();
        if (scheduleAccess != null) {
            Optional<DoctorScheduleEntity> schOpt = scheduleAccess.findByDoctorId(doctorId);
            if (schOpt.isPresent() && DoctorSlotGenerator.scheduleHasEnabledWorkingDay(schOpt.get())) {
                usesSchedule = true;
                allowed = DoctorSlotGenerator.generateSlotValues(d, hospitalZoneId, schOpt.get());
            } else {
                allowed = LegacySlotCatalog.slotValues();
            }
        } else {
            allowed = LegacySlotCatalog.slotValues();
        }
        if (!allowed.contains(preferredTimeSlot)) {
            throw new IllegalArgumentException(usesSchedule
                    ? "Selected time slot is not offered for this doctor on this date."
                    : "Selected time slot is not valid.");
        }
    }

    public AppointmentEntity.AppointmentFile getFile(String appointmentId, String fileId, String actorUserId) {
        AppointmentAccess repository = requireAppointmentAccess();
        AppointmentEntity entity = repository.findById(appointmentId)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        List<AppointmentEntity.AppointmentFile> files = entity.getPrescriptionFiles();
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("File not found");
        }
        return files.stream()
                .filter(file -> fileId.equals(file.getFileId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("File not found"));
    }

    private void applyRequest(AppointmentEntity entity, AppointmentRequest request, List<MultipartFile> prescriptionFiles) {
        if (request == null) {
            throw new IllegalArgumentException("Appointment request is required");
        }
        String patientName = normalize(request.getPatientName());
        String email = normalize(request.getEmail());
        String phoneNumber = normalize(request.getPhoneNumber());
        String ageGroup = normalize(request.getAgeGroup());
        String department = normalize(request.getDepartment());
        String doctorId = normalize(request.getDoctorId());
        String preferredDate = normalize(request.getPreferredDate());
        String preferredTimeSlot = normalize(request.getPreferredTimeSlot());

        if (patientName.isBlank()) throw new IllegalArgumentException("PatientName is required");
        if (email.isBlank()) throw new IllegalArgumentException("Email is required");
        if (phoneNumber.isBlank()) throw new IllegalArgumentException("PhoneNumber is required");
        if (ageGroup.isBlank()) throw new IllegalArgumentException("AgeGroup is required");
        if (department.isBlank()) throw new IllegalArgumentException("Department is required");
        if (doctorId.isBlank()) throw new IllegalArgumentException("DoctorId is required");
        if (preferredDate.isBlank()) throw new IllegalArgumentException("PreferredDate is required");
        if (preferredTimeSlot.isBlank()) throw new IllegalArgumentException("PreferredTimeSlot is required");

        entity.setPatientName(patientName);
        entity.setEmail(email);
        entity.setPhoneNumber(phoneNumber);
        entity.setAgeGroup(ageGroup);
        entity.setDepartment(department);
        entity.setDoctorId(doctorId);
        entity.setPreferredDate(preferredDate);
        entity.setPreferredTimeSlot(preferredTimeSlot);
        entity.setAdditionalNotes(normalize(request.getAdditionalNotes()));
        if (prescriptionFiles != null && !prescriptionFiles.isEmpty()) {
            entity.setPrescriptionFiles(toAppointmentFiles(prescriptionFiles));
        }
    }

    private String resolveDoctorName(String doctorId) {
        UserAccess ua = userAccessProvider.getIfAvailable();
        if (ua == null || doctorId == null || doctorId.isBlank()) {
            return "";
        }
        return ua.findById(doctorId)
                .map(this::displayName)
                .orElse("");
    }

    private String resolveDoctorEmail(String doctorId) {
        UserAccess ua = userAccessProvider.getIfAvailable();
        if (ua == null || doctorId == null || doctorId.isBlank()) {
            return "";
        }
        return ua.findById(doctorId)
                .map(UserEntity::getEmail)
                .map(this::normalize)
                .orElse("");
    }

    private String displayName(UserEntity userEntity) {
        String firstName = normalize(userEntity.getFirstName());
        String lastName = normalize(userEntity.getLastName());
        String fullName = (firstName + " " + lastName).trim();
        if (!fullName.isBlank()) {
            return fullName;
        }
        return normalize(userEntity.getUsername());
    }

    private List<AppointmentEntity.AppointmentFile> toAppointmentFiles(List<MultipartFile> files) {
        List<AppointmentEntity.AppointmentFile> mapped = new ArrayList<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String fileName = normalize(file.getOriginalFilename());
            if (fileName.isBlank()) {
                continue;
            }
            AppointmentEntity.AppointmentFile appointmentFile = new AppointmentEntity.AppointmentFile();
            appointmentFile.setFileId(UUID.randomUUID().toString());
            appointmentFile.setFileName(fileName);
            appointmentFile.setContentType(normalize(file.getContentType()));
            appointmentFile.setSize(file.getSize());
            try {
                appointmentFile.setData(file.getBytes());
            } catch (IOException ex) {
                throw new IllegalArgumentException("Unable to read uploaded file: " + fileName);
            }
            mapped.add(appointmentFile);
        }
        return mapped;
    }

    private void assertNoActiveSlotConflict(String doctorId, String preferredDate, String preferredTimeSlot, String excludeAppointmentId) {
        if (doctorId.isBlank() || preferredDate.isBlank() || preferredTimeSlot.isBlank()) {
            return;
        }
        AppointmentAccess repository = requireAppointmentAccess();
        List<AppointmentEntity> rows = repository.findByDoctorIdAndPreferredDate(doctorId, preferredDate);
        String exclude = normalize(excludeAppointmentId);
        for (AppointmentEntity row : rows) {
            if (!exclude.isBlank() && exclude.equals(row.getId())) {
                continue;
            }
            if (!isOpenAppointmentBlockingSlot(row)) {
                continue;
            }
            if (normalize(row.getPreferredTimeSlot()).equals(preferredTimeSlot)) {
                throw new IllegalArgumentException("This time slot is already booked for the selected doctor and date.");
            }
        }
    }

    private void ensureActorCanQueryDoctorOccupiedSlots(String actorUserId, String doctorId) {
        UserRole actorRole = resolveUserRole(actorUserId);
        if (actorRole == UserRole.ADMIN) {
            return;
        }
        if (actorRole == UserRole.DOCTOR && !doctorId.equals(normalize(actorUserId))) {
            throw new SecurityException("You can only view availability for your own schedule.");
        }
    }

    private boolean isCancelled(AppointmentEntity entity) {
        return STATUS_CANCELLED.equalsIgnoreCase(normalize(entity.getStatus()));
    }

    /**
     * Only active (open) appointments block a slot in booking availability and conflict checks.
     * Cancelled and non-open statuses (e.g. completed) do not consume the slot for new bookings.
     */
    private boolean isOpenAppointmentBlockingSlot(AppointmentEntity row) {
        if (isCancelled(row)) {
            return false;
        }
        if (STATUS_DELETED.equalsIgnoreCase(normalize(row.getStatus()))) {
            return false;
        }
        String s = normalize(row.getStatus());
        return s.isEmpty() || DEFAULT_STATUS_OPEN.equalsIgnoreCase(s);
    }

    private boolean isGridDateBeforeToday(String preferredDate) {
        LocalDate parsed = parseIsoLocalDate(preferredDate);
        if (parsed == null) {
            return false;
        }
        return parsed.isBefore(LocalDate.now());
    }

    private LocalDate parseIsoLocalDate(String raw) {
        String d = normalize(raw);
        if (d.length() >= 10) {
            d = d.substring(0, 10);
        }
        if (d.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(d);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private String preferredDateKey(String raw) {
        LocalDate parsed = parseIsoLocalDate(raw);
        return parsed == null ? "" : parsed.toString();
    }

    private Integer parseSlotStartMinutes(String slotValue) {
        String value = normalize(slotValue);
        if (value.isBlank()) {
            return null;
        }
        int dash = value.indexOf('-');
        String start = dash >= 0 ? value.substring(0, dash).trim() : value;
        if (start.length() < 4 || start.charAt(start.length() - 3) != ':') {
            return null;
        }
        try {
            String[] parts = start.split(":");
            if (parts.length != 2) {
                return null;
            }
            int hours = Integer.parseInt(parts[0]);
            int minutes = Integer.parseInt(parts[1]);
            if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                return null;
            }
            return hours * 60 + minutes;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private int countUnblockedSlots(
            List<String> baseSlots,
            Set<String> occupied,
            String isoDate,
            String todayIso,
            int nowMinutes
    ) {
        int count = 0;
        for (String value : baseSlots) {
            if (occupied.contains(value)) {
                continue;
            }
            if (isoDate.equals(todayIso)) {
                Integer startMinutes = parseSlotStartMinutes(value);
                if (startMinutes != null && startMinutes <= nowMinutes) {
                    continue;
                }
            }
            count += 1;
        }
        return count;
    }

    private void ensureCanAccessAppointment(AppointmentEntity entity, String actorUserId) {
        if (entity == null) {
            throw new IllegalArgumentException("Appointment not found");
        }
        UserRole actorRole = resolveUserRole(actorUserId);
        if (actorRole == UserRole.ADMIN) {
            return;
        }
        String doctorId = normalize(entity.getDoctorId());
        if (actorRole == UserRole.DOCTOR && doctorId.equals(actorUserId)) {
            return;
        }
        String createdBy = normalize(entity.getCreatedBy());
        if (!createdBy.equals(actorUserId)) {
            throw new SecurityException("You do not have access to this appointment");
        }
    }

    private UserRole resolveUserRole(String actorUserId) {
        UserAccess users = requireUserAccess();
        UserEntity user = users.findById(actorUserId)
                .orElseThrow(() -> new SecurityException("User not found"));
        return user.getRole();
    }

    private AppointmentResponse toResponse(AppointmentEntity entity) {
        List<AppointmentFileResponse> files = mapFileResponses(entity);
        return new AppointmentResponse(
                entity.getId(),
                entity.getPatientName(),
                entity.getEmail(),
                entity.getPhoneNumber(),
                entity.getAgeGroup(),
                entity.getDepartment(),
                entity.getDoctorId(),
                entity.getDoctorName(),
                entity.getPreferredDate(),
                entity.getPreferredTimeSlot(),
                resolveStatus(entity),
                entity.getAdditionalNotes(),
                files,
                entity.getCreatedTimestamp() == null ? null : entity.getCreatedTimestamp().toString(),
                entity.getUpdatedTimestamp() == null ? null : entity.getUpdatedTimestamp().toString(),
                entity.getCreatedBy(),
                entity.getUpdatedBy(),
                emptyToNull(normalize(entity.getAppointmentEmailNotifyStatus())),
                entity.getAppointmentEmailNotifyFailed(),
                entity.getAppointmentEmailNotifyDetail(),
                entity.getAppointmentEmailNotifyAt() == null ? null : entity.getAppointmentEmailNotifyAt().toString(),
                emptyToNull(normalize(entity.getCallStatus())),
                entity.getCallStartTime() == null ? null : entity.getCallStartTime().toString(),
                entity.getCallEndTime() == null ? null : entity.getCallEndTime().toString()
        );
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static final int EMAIL_NOTIFY_DETAIL_MAX = 500;

    private void applyEmailNotifyOutcome(AppointmentEntity entity, AppointmentEmailNotifyOutcome outcome) {
        entity.setAppointmentEmailNotifyStatus(outcome.status());
        entity.setAppointmentEmailNotifyFailed(outcome.failed());
        entity.setAppointmentEmailNotifyDetail(truncateEmailNotifyDetail(outcome.detail()));
        entity.setUpdatedTimestamp(Instant.now());
        entity.setAppointmentEmailNotifyAt(Instant.now());
    }

    private static String truncateEmailNotifyDetail(String detail) {
        if (detail == null || detail.isBlank()) {
            return null;
        }
        String t = detail.trim();
        if (t.length() <= EMAIL_NOTIFY_DETAIL_MAX) {
            return t;
        }
        return t.substring(0, EMAIL_NOTIFY_DETAIL_MAX - 3) + "...";
    }

    private String resolveStatus(AppointmentEntity entity) {
        String status = normalize(entity.getStatus());
        return status.isBlank() ? DEFAULT_STATUS_OPEN : status;
    }

    private List<AppointmentFileResponse> mapFileResponses(AppointmentEntity entity) {
        if (entity.getPrescriptionFiles() == null || entity.getPrescriptionFiles().isEmpty()) {
            return List.of();
        }
        String appointmentId = entity.getId();
        return entity.getPrescriptionFiles().stream()
                .map(file -> new AppointmentFileResponse(
                        file.getFileId(),
                        file.getFileName(),
                        file.getContentType(),
                        file.getSize(),
                        "/api/appointment/file/" + appointmentId + "/" + file.getFileId()))
                .toList();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private AppointmentAccess requireAppointmentAccess() {
        AppointmentAccess access = appointmentAccessProvider.getIfAvailable();
        if (access == null) {
            throw new IllegalStateException("Appointment persistence is unavailable");
        }
        return access;
    }

    private UserAccess requireUserAccess() {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            throw new IllegalStateException("User persistence is unavailable");
        }
        return users;
    }

}
