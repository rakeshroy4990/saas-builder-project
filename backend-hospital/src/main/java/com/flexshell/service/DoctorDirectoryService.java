package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.DoctorOptionResponse;
import com.flexshell.medicaldepartment.MedicalDepartmentRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class DoctorDirectoryService {
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final ObjectProvider<MedicalDepartmentRepository> medicalDepartmentRepositoryProvider;

    public DoctorDirectoryService(
            ObjectProvider<UserAccess> userAccessProvider,
            ObjectProvider<MedicalDepartmentRepository> medicalDepartmentRepositoryProvider
    ) {
        this.userAccessProvider = userAccessProvider;
        this.medicalDepartmentRepositoryProvider = medicalDepartmentRepositoryProvider;
    }

    public List<DoctorOptionResponse> getDoctorsByDepartment(String department, int page, int size) {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            throw new IllegalStateException("Doctor directory service is unavailable");
        }
        String normalizedDepartment = department == null ? "" : department.trim();
        if (normalizedDepartment.isBlank()) {
            throw new IllegalArgumentException("Department is required");
        }
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? 20 : Math.min(size, 100);
        List<String> candidateDepartments = resolveCandidateDepartments(normalizedDepartment);
        List<String> departmentKeysLower = candidateDepartments.stream()
                .map(value -> value.toLowerCase(Locale.ROOT))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
        if (departmentKeysLower.isEmpty()) {
            throw new IllegalArgumentException("Department is required");
        }
        return users.findActiveDoctorsByDepartments(
                        UserRole.DOCTOR,
                        RoleRequestStatus.ACTIVE,
                        departmentKeysLower,
                        PageRequest.of(safePage, safeSize))
                .map(this::toDoctorOption)
                .getContent();
    }

    /**
     * Active doctors across all departments (admin scheduling UI).
     */
    public List<DoctorOptionResponse> listActiveDoctorsForAdmin(String actorUserId, int page, int size) {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            throw new IllegalStateException("Doctor directory service is unavailable");
        }
        requireAdmin(actorUserId, users);
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? 100 : Math.min(size, 500);
        return users.findActiveDoctorsAllRoles(
                        UserRole.DOCTOR,
                        RoleRequestStatus.ACTIVE,
                        PageRequest.of(safePage, safeSize))
                .map(this::toDoctorOption)
                .getContent();
    }

    private void requireAdmin(String actorUserId, UserAccess users) {
        String id = actorUserId == null ? "" : actorUserId.trim();
        if (id.isBlank()) {
            throw new SecurityException("Authentication required");
        }
        UserEntity actor = users.findById(id).orElseThrow(() -> new SecurityException("User not found"));
        if (actor.getRole() != UserRole.ADMIN) {
            throw new SecurityException("Admin access required");
        }
    }

    private List<String> resolveCandidateDepartments(String requestedDepartment) {
        List<String> candidates = new ArrayList<>();
        addIfMissing(candidates, requestedDepartment);
        MedicalDepartmentRepository medicalDepartmentRepository = medicalDepartmentRepositoryProvider.getIfAvailable();
        if (medicalDepartmentRepository != null) {
            medicalDepartmentRepository.findByCodeIgnoreCase(requestedDepartment)
                    .map(entity -> entity.getName() == null ? "" : entity.getName().trim())
                    .ifPresent(name -> addIfMissing(candidates, name));
        }
        return candidates;
    }

    private void addIfMissing(List<String> values, String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) {
            return;
        }
        boolean exists = values.stream().anyMatch(existing -> existing.equalsIgnoreCase(normalized));
        if (!exists) {
            values.add(normalized);
        }
    }

    private DoctorOptionResponse toDoctorOption(UserEntity userEntity) {
        String firstName = userEntity.getFirstName() == null ? "" : userEntity.getFirstName().trim();
        String lastName = userEntity.getLastName() == null ? "" : userEntity.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        String fallbackName = userEntity.getUsername() == null ? "" : userEntity.getUsername().trim();
        return new DoctorOptionResponse(
                userEntity.getId(),
                fullName.isBlank() ? fallbackName : fullName,
                firstName,
                lastName,
                userEntity.getEmail(),
                userEntity.getDepartment()
        );
    }
}
