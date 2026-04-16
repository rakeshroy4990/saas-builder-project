package com.flexshell.service;

import com.flexshell.appointment.AppointmentEntity;
import com.flexshell.appointment.AppointmentRepository;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.AppointmentFileResponse;
import com.flexshell.controller.dto.AppointmentRequest;
import com.flexshell.controller.dto.AppointmentResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AppointmentService {
    private static final String DEFAULT_STATUS_OPEN = "Open";
    private final ObjectProvider<AppointmentRepository> appointmentRepositoryProvider;
    private final ObjectProvider<UserRepository> userRepositoryProvider;

    public AppointmentService(
            ObjectProvider<AppointmentRepository> appointmentRepositoryProvider,
            ObjectProvider<UserRepository> userRepositoryProvider
    ) {
        this.appointmentRepositoryProvider = appointmentRepositoryProvider;
        this.userRepositoryProvider = userRepositoryProvider;
    }

    public AppointmentResponse create(AppointmentRequest request, List<MultipartFile> prescriptionFiles, String actorUserId) {
        AppointmentRepository repository = requireAppointmentRepository();
        AppointmentEntity entity = new AppointmentEntity();
        applyRequest(entity, request, prescriptionFiles);
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
        Page<AppointmentEntity> result = isAdmin(actorUserId)
                ? repository.findAll(pageRequest)
                : repository.findByCreatedBy(actorUserId, pageRequest);
        return result.stream().map(this::toResponse).toList();
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

    private void ensureCanAccessAppointment(AppointmentEntity entity, String actorUserId) {
        if (entity == null) {
            throw new IllegalArgumentException("Appointment not found");
        }
        if (isAdmin(actorUserId)) {
            return;
        }
        String createdBy = normalize(entity.getCreatedBy());
        if (!createdBy.equals(actorUserId)) {
            throw new SecurityException("You do not have access to this appointment");
        }
    }

    private boolean isAdmin(String actorUserId) {
        UserRepository userRepository = requireUserRepository();
        UserEntity user = userRepository.findById(actorUserId)
                .orElseThrow(() -> new SecurityException("User not found"));
        return user.getRole() == UserRole.ADMIN;
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
