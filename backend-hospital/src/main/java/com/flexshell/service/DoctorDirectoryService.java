package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.DoctorOptionResponse;
import com.flexshell.persistence.api.MedicalDepartmentAccess;
import com.flexshell.medicaldepartment.MedicalDepartmentEntity;
import com.flexshell.medicaldepartment.MedicalDepartmentLocaleCatalog;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class DoctorDirectoryService {
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final ObjectProvider<MedicalDepartmentAccess> medicalDepartmentAccessProvider;
    private final ObjectProvider<MedicalDepartmentLocaleCatalog> localeCatalogProvider;

    public DoctorDirectoryService(
            ObjectProvider<UserAccess> userAccessProvider,
            ObjectProvider<MedicalDepartmentAccess> medicalDepartmentAccessProvider,
            ObjectProvider<MedicalDepartmentLocaleCatalog> localeCatalogProvider
    ) {
        this.userAccessProvider = userAccessProvider;
        this.medicalDepartmentAccessProvider = medicalDepartmentAccessProvider;
        this.localeCatalogProvider = localeCatalogProvider;
    }

    public List<DoctorOptionResponse> getDoctorsByDepartment(String department, int page, int size, String locale) {
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
                .map(user -> toDoctorOption(user, locale))
                .getContent();
    }

    /**
     * Active doctors across all departments (public marketing / home page).
     */
    public List<DoctorOptionResponse> listActiveDoctorsPublic(int page, int size, String locale) {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            throw new IllegalStateException("Doctor directory service is unavailable");
        }
        int safePage = Math.max(page, 0);
        int safeSize = size <= 0 ? 50 : Math.min(size, 200);
        return users.findActiveDoctorsAllRoles(
                        UserRole.DOCTOR,
                        RoleRequestStatus.ACTIVE,
                        PageRequest.of(safePage, safeSize))
                .map(user -> toDoctorOption(user, locale))
                .getContent();
    }

    /**
     * Active doctors across all departments (admin scheduling UI).
     */
    public List<DoctorOptionResponse> listActiveDoctorsForAdmin(String actorUserId, int page, int size, String locale) {
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
                .map(user -> toDoctorOption(user, locale))
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
        MedicalDepartmentAccess medicalDepartmentAccess = medicalDepartmentAccessProvider.getIfAvailable();
        if (medicalDepartmentAccess != null) {
            medicalDepartmentAccess.findByCodeIgnoreCase(requestedDepartment)
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

    private DoctorOptionResponse toDoctorOption(UserEntity userEntity, String locale) {
        String firstName = userEntity.getFirstName() == null ? "" : userEntity.getFirstName().trim();
        String lastName = userEntity.getLastName() == null ? "" : userEntity.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        String fallbackName = userEntity.getUsername() == null ? "" : userEntity.getUsername().trim();
        String department = userEntity.getDepartment() == null ? "" : userEntity.getDepartment().trim();
        DoctorOptionResponse response = new DoctorOptionResponse(
                userEntity.getId(),
                fullName.isBlank() ? fallbackName : fullName,
                firstName,
                lastName,
                userEntity.getEmail(),
                department
        );
        response.setSpeciality(resolveSpecialityLabel(department, locale));
        response.setQualifications(trimOrEmpty(userEntity.getQualifications()));
        response.setExperienceSummary(trimOrEmpty(userEntity.getExperienceSummary()));
        response.setProfilePic(trimOrEmpty(userEntity.getProfilePic()));
        return response;
    }

    private String resolveSpecialityLabel(String departmentRaw, String locale) {
        String department = departmentRaw == null ? "" : departmentRaw.trim();
        if (department.isBlank()) {
            return "";
        }
        MedicalDepartmentAccess medicalDepartmentAccess = medicalDepartmentAccessProvider.getIfAvailable();
        if (medicalDepartmentAccess != null) {
            var byCode = medicalDepartmentAccess.findByCodeIgnoreCase(department);
            if (byCode.isPresent()) {
                return localizedDepartmentName(byCode.get(), locale);
            }
        }
        return department;
    }

    private String localizedDepartmentName(MedicalDepartmentEntity entity, String locale) {
        MedicalDepartmentLocaleCatalog catalog = localeCatalogProvider.getIfAvailable();
        if (catalog != null) {
            MedicalDepartmentLocaleCatalog.ResolvedCopy resolved = catalog.resolve(
                    entity.getId(),
                    locale,
                    entity.getName(),
                    entity.getDescription()
            );
            if (resolved.name() != null && !resolved.name().isBlank()) {
                return resolved.name().trim();
            }
        }
        String name = entity.getName();
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        return entity.getCode() == null ? "" : entity.getCode().trim();
    }

    private static String trimOrEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
