package com.flexshell.service;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.appointment.AppointmentRepository;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.AppointmentFileResponse;
import com.flexshell.controller.dto.AppointmentRequest;
import com.flexshell.controller.dto.AppointmentResponse;
import com.flexshell.controller.dto.AvailableSlotDto;
import com.flexshell.controller.dto.AvailableSlotsResponse;
import com.flexshell.doctorschedule.DoctorScheduleEntity;
import com.flexshell.doctorschedule.DoctorScheduleRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class AppointmentService {
    private static final String DEFAULT_STATUS_OPEN = "Open";
    private static final String STATUS_CANCELLED = "CANCELLED";
    private static final String STATUS_COMPLETED = "COMPLETED";
    private final ObjectProvider<AppointmentRepository> appointmentRepositoryProvider;
    private final ObjectProvider<UserRepository> userRepositoryProvider;
    private final ObjectProvider<DoctorScheduleRepository> doctorScheduleRepositoryProvider;
    private final ZoneId hospitalZoneId;

    public AppointmentService(
            ObjectProvider<AppointmentRepository> appointmentRepositoryProvider,
            ObjectProvider<UserRepository> userRepositoryProvider,
            ObjectProvider<DoctorScheduleRepository> doctorScheduleRepositoryProvider,
            @Qualifier("hospitalZoneId") ZoneId hospitalZoneId
    ) {
        this.appointmentRepositoryProvider = appointmentRepositoryProvider;
        this.userRepositoryProvider = userRepositoryProvider;
        this.doctorScheduleRepositoryProvider = doctorScheduleRepositoryProvider;
        this.hospitalZoneId = hospitalZoneId;
    }

    public AppointmentResponse create(AppointmentRequest request, List<MultipartFile> prescriptionFiles, String actorUserId) {
        AppointmentRepository repository = requireAppointmentRepository();
        AppointmentEntity entity = new AppointmentEntity();
        applyRequest(entity, request, prescriptionFiles);
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
        return toResponse(repository.save(entity));
    }

    public AppointmentResponse update(String id, AppointmentRequest request, List<MultipartFile> prescriptionFiles, String actorUserId) {
        AppointmentRepository repository = requireAppointmentRepository();
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
        return toResponse(repository.save(entity));
    }

    public boolean delete(String id, String actorUserId) {
        AppointmentRepository repository = requireAppointmentRepository();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        repository.deleteById(id);
        return true;
    }

    /** Soft cancel: sets status to CANCELLED instead of removing the document. */
    public AppointmentResponse cancel(String id, String actorUserId) {
        AppointmentRepository repository = requireAppointmentRepository();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        if (STATUS_CANCELLED.equalsIgnoreCase(normalize(entity.getStatus()))) {
            return toResponse(entity);
        }
        entity.setStatus(STATUS_CANCELLED);
        entity.setUpdatedTimestamp(Instant.now());
        entity.setUpdatedBy(actorUserId);
        return toResponse(repository.save(entity));
    }

    /**
     * Marks a consultation as completed so the assigned doctor can issue a structured e-prescription.
     * Only the assigned doctor may complete (patients and admins use other flows).
     */
    public AppointmentResponse completeVisit(String id, String actorUserId) {
        AppointmentRepository repository = requireAppointmentRepository();
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
        AppointmentRepository repository = requireAppointmentRepository();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        return entity;
    }

    public AppointmentResponse getById(String id, String actorUserId) {
        AppointmentRepository repository = requireAppointmentRepository();
        AppointmentEntity entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Appointment not found"));
        ensureCanAccessAppointment(entity, actorUserId);
        return toResponse(entity);
    }

    public List<AppointmentResponse> getAll(String actorUserId, int page, int size) {
        AppointmentRepository repository = requireAppointmentRepository();
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? 20 : Math.min(size, 100);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize);
        UserRole actorRole = resolveUserRole(actorUserId);
        Page<AppointmentEntity> result;
        if (actorRole == UserRole.ADMIN) {
            result = repository.findAll(pageRequest);
        } else if (actorRole == UserRole.DOCTOR) {
            result = repository.findByDoctorId(actorUserId, pageRequest);
        } else {
            result = repository.findByCreatedBy(actorUserId, pageRequest);
        }
        return result.stream().map(this::toResponse).toList();
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
        AppointmentRepository repository = requireAppointmentRepository();
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
        DoctorScheduleRepository scheduleRepository = doctorScheduleRepositoryProvider.getIfAvailable();
        if (scheduleRepository != null) {
            Optional<DoctorScheduleEntity> schOpt = scheduleRepository.findByDoctorId(docId);
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
        DoctorScheduleRepository scheduleRepository = doctorScheduleRepositoryProvider.getIfAvailable();
        if (scheduleRepository != null) {
            Optional<DoctorScheduleEntity> schOpt = scheduleRepository.findByDoctorId(doctorId);
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
        AppointmentRepository repository = requireAppointmentRepository();
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
        UserRepository userRepository = userRepositoryProvider.getIfAvailable();
        if (userRepository == null || doctorId == null || doctorId.isBlank()) {
            return "";
        }
        return userRepository.findById(doctorId)
                .map(this::displayName)
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
        AppointmentRepository repository = requireAppointmentRepository();
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
        UserRepository userRepository = requireUserRepository();
        UserEntity user = userRepository.findById(actorUserId)
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
                entity.getUpdatedBy()
        );
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

    private AppointmentRepository requireAppointmentRepository() {
        AppointmentRepository repository = appointmentRepositoryProvider.getIfAvailable();
        if (repository == null) {
            throw new IllegalStateException("Appointment repository is unavailable");
        }
        return repository;
    }

    private UserRepository requireUserRepository() {
        UserRepository repository = userRepositoryProvider.getIfAvailable();
        if (repository == null) {
            throw new IllegalStateException("User repository is unavailable");
        }
        return repository;
    }
}
