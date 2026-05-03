package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.api.AuthApiException;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import com.flexshell.controller.dto.DoctorAdminRow;
import com.flexshell.security.PasswordPolicy;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class AdminDoctorManagementService {
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final PasswordPolicy passwordPolicy;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AdminDoctorManagementService(
            ObjectProvider<UserAccess> userAccessProvider,
            PasswordPolicy passwordPolicy
    ) {
        this.userAccessProvider = userAccessProvider;
        this.passwordPolicy = passwordPolicy;
    }

    public List<DoctorAdminRow> listDoctors(String adminUserId, int page, int size) {
        UserAccess repo = requireRepository();
        AdminAuthorizationSupport.requireAdminUser(repo, adminUserId);
        int safePage = Math.max(0, page);
        int safeSize = size <= 0 ? 50 : Math.min(size, 500);
        Page<UserEntity> result = repo.findByRole(UserRole.DOCTOR, PageRequest.of(safePage, safeSize));
        return result.stream().map(this::toRow).toList();
    }

    /**
     * Creates an active doctor account (admin onboarding). Password policy applies.
     */
    public RegisterResponse registerDoctor(RegisterRequest request, String adminUserId) {
        UserAccess users = requireRepository();
        AdminAuthorizationSupport.requireAdminUser(users, adminUserId);

        if (request == null) {
            throw new IllegalArgumentException("Request body is required");
        }
        String email = request.getEmailId() == null ? "" : request.getEmailId().trim().toLowerCase();
        String firstName = request.getFirstName() == null ? "" : request.getFirstName().trim();
        String lastName = request.getLastName() == null ? "" : request.getLastName().trim();
        String rawPassword = request.getPassword() == null ? "" : request.getPassword().trim();
        String address = request.getAddress() == null ? "" : request.getAddress().trim();
        String gender = request.getGender() == null ? "" : request.getGender().trim();
        String mobileNumber = request.getMobileNumber() == null ? "" : request.getMobileNumber().trim();
        String department = request.getDepartment() == null ? "" : request.getDepartment().trim();
        if (firstName.isEmpty() || lastName.isEmpty() || email.isEmpty() || rawPassword.isEmpty()
                || address.isEmpty() || gender.isEmpty() || mobileNumber.isEmpty()) {
            throw new IllegalArgumentException("First name, last name, email, password, address, gender, and mobile are required");
        }

        try {
            passwordPolicy.validateOrThrow(rawPassword);
        } catch (AuthApiException ex) {
            throw new IllegalArgumentException(ex.getMessage());
        }

        Optional<UserEntity> existingOpt = users.findByEmail(email);
        if (existingOpt.isPresent()) {
            throw new IllegalArgumentException("An account already exists for this email address.");
        }

        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setUsername(buildDisplayName(firstName, lastName));
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setAddress(address);
        user.setGender(gender);
        user.setMobileNumber(mobileNumber);
        user.setDepartment(department);
        user.setQualifications(request.getQualifications() == null ? "" : request.getQualifications().trim());
        user.setSmcName(request.getSmcName() == null ? "" : request.getSmcName().trim());
        user.setSmcRegistrationNumber(
                request.getSmcRegistrationNumber() == null ? "" : request.getSmcRegistrationNumber().trim());
        Instant now = Instant.now();
        user.setCreatedTimestamp(now);
        user.setUpdatedTimestamp(now);
        user.setActive(true);
        user.setTokenVersion(1L);
        user.setRole(UserRole.DOCTOR);
        user.setRoleStatus(RoleRequestStatus.ACTIVE);
        user.setRequestedRole(null);
        user.setRoleRequestedAt(null);
        user.setRoleDecisionAt(null);
        user.setRoleDecisionBy(null);
        user.setRoleRejectedReason(null);

        String q = user.getQualifications().trim();
        String smc = user.getSmcName().trim();
        String reg = user.getSmcRegistrationNumber().trim();
        if (q.isEmpty() || smc.isEmpty() || reg.isEmpty()) {
            throw new IllegalArgumentException("Doctor qualifications, State Medical Council (SmcName), and SMC registration number are required.");
        }

        UserEntity saved = users.save(user);
        return new RegisterResponse(
                saved.getId(),
                saved.getEmail(),
                saved.getFirstName(),
                saved.getLastName(),
                null,
                saved.getAddress(),
                saved.getGender(),
                saved.getMobileNumber(),
                saved.getDepartment(),
                saved.getQualifications(),
                saved.getSmcName(),
                saved.getSmcRegistrationNumber(),
                saved.getCreatedTimestamp() == null ? null : saved.getCreatedTimestamp().toString(),
                saved.getUpdatedTimestamp() == null ? null : saved.getUpdatedTimestamp().toString(),
                saved.getRole() == null ? UserRole.DOCTOR.name() : saved.getRole().name(),
                saved.getRoleStatus() == null ? RoleRequestStatus.ACTIVE.name() : saved.getRoleStatus().name(),
                null,
                null);
    }

    private DoctorAdminRow toRow(UserEntity u) {
        String firstName = u.getFirstName() == null ? "" : u.getFirstName().trim();
        String lastName = u.getLastName() == null ? "" : u.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        String fallback = u.getUsername() == null ? "" : u.getUsername().trim();
        return new DoctorAdminRow(
                u.getId(),
                fullName.isBlank() ? fallback : fullName,
                firstName,
                lastName,
                u.getEmail(),
                u.getDepartment(),
                u.getRole() == null ? "" : u.getRole().name(),
                u.getRoleStatus() == null ? "" : u.getRoleStatus().name(),
                u.isActive()
        );
    }

    private static String buildDisplayName(String firstName, String lastName) {
        String f = firstName == null ? "" : firstName.trim();
        String l = lastName == null ? "" : lastName.trim();
        String joined = (f + " " + l).trim();
        return joined.isEmpty() ? "User" : joined;
    }

    private UserAccess requireRepository() {
        UserAccess r = userAccessProvider.getIfAvailable();
        if (r == null) {
            throw new IllegalStateException("User persistence unavailable");
        }
        return r;
    }
}
