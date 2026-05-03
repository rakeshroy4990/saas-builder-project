package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {
    private final ObjectProvider<UserAccess> userAccessProvider;

    public UserService(ObjectProvider<UserAccess> userAccessProvider) {
        this.userAccessProvider = userAccessProvider;
    }

    public Optional<RegisterResponse> getByUserId(String actorUserId) {
        UserAccess repo = userAccessProvider.getIfAvailable();
        if (repo == null || actorUserId == null || actorUserId.isBlank()) {
            return Optional.empty();
        }
        return repo.findById(actorUserId.trim()).map(this::toRegisterResponse);
    }

    public RegisterResponse updateProfile(String actorUserId, RegisterRequest request) {
        UserAccess repo = userAccessProvider.getIfAvailable();
        if (repo == null) {
            throw new IllegalStateException("User persistence unavailable");
        }
        String id = actorUserId == null ? "" : actorUserId.trim();
        if (id.isEmpty()) {
            throw new IllegalArgumentException("Missing user");
        }
        UserEntity user = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!user.isActive()) {
            throw new IllegalArgumentException("Account is inactive");
        }

        String firstName = mergeTrim(request.getFirstName(), user.getFirstName());
        String lastName = mergeTrim(request.getLastName(), user.getLastName());
        String emailRaw = mergeTrim(request.getEmailId(), user.getEmail());
        String address = mergeTrim(request.getAddress(), user.getAddress());
        String gender = mergeTrim(request.getGender(), user.getGender());
        String mobile = mergeTrim(request.getMobileNumber(), user.getMobileNumber());
        String department = request.getDepartment() != null ? request.getDepartment().trim() : nz(user.getDepartment());

        if (firstName.isEmpty() || lastName.isEmpty() || emailRaw.isEmpty() || address.isEmpty() || gender.isEmpty() || mobile.isEmpty()) {
            throw new IllegalArgumentException("First name, last name, email, address, gender, and mobile number are required");
        }
        String emailNorm = emailRaw.toLowerCase();
        Optional<UserEntity> other = repo.findByEmail(emailNorm);
        if (other.isPresent() && !other.get().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Email is already in use");
        }

        user.setEmail(emailNorm);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setAddress(address);
        user.setGender(gender);
        user.setMobileNumber(mobile);
        user.setDepartment(department);

        if (UserRole.DOCTOR.equals(user.getRole())) {
            // Only apply non-blank values so clients that echo "" for unchanged fields do not wipe Mongo.
            if (request.getQualifications() != null && !request.getQualifications().trim().isEmpty()) {
                user.setQualifications(request.getQualifications().trim());
            }
            if (request.getSmcName() != null && !request.getSmcName().trim().isEmpty()) {
                user.setSmcName(request.getSmcName().trim());
            }
            if (request.getSmcRegistrationNumber() != null && !request.getSmcRegistrationNumber().trim().isEmpty()) {
                user.setSmcRegistrationNumber(request.getSmcRegistrationNumber().trim());
            }
            String q = user.getQualifications() == null ? "" : user.getQualifications().trim();
            String smc = user.getSmcName() == null ? "" : user.getSmcName().trim();
            String reg = user.getSmcRegistrationNumber() == null ? "" : user.getSmcRegistrationNumber().trim();
            List<String> missingDoctorFields = new ArrayList<>();
            if (q.isEmpty()) {
                missingDoctorFields.add("Qualifications");
            }
            if (smc.isEmpty()) {
                missingDoctorFields.add("State Medical Council (SmcName)");
            }
            if (reg.isEmpty()) {
                missingDoctorFields.add("SMC registration number (SmcRegistrationNumber)");
            }
            if (!missingDoctorFields.isEmpty()) {
                throw new IllegalArgumentException(
                        "For doctor accounts, the following must be non-empty: " + String.join(", ", missingDoctorFields)
                                + ".");
            }
        }

        user.setUsername(buildDisplayName(user.getFirstName(), user.getLastName()));
        user.setUpdatedTimestamp(Instant.now());
        UserEntity saved = repo.save(user);
        return toRegisterResponse(saved);
    }

    public void deactivateAccount(String actorUserId) {
        UserAccess repo = userAccessProvider.getIfAvailable();
        if (repo == null) {
            throw new IllegalStateException("User persistence unavailable");
        }
        String id = actorUserId == null ? "" : actorUserId.trim();
        if (id.isEmpty()) {
            throw new IllegalArgumentException("Missing user");
        }
        UserEntity user = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        applyDeactivation(user);
        repo.save(user);
    }

    /**
     * Admin-only: soft-deactivate another user (e.g. doctor offboarding). Cannot target own account.
     */
    public void deactivateUserAsAdmin(String targetUserId, String adminUserId) {
        UserAccess repo = userAccessProvider.getIfAvailable();
        if (repo == null) {
            throw new IllegalStateException("User persistence unavailable");
        }
        AdminAuthorizationSupport.requireAdminUser(repo, adminUserId);
        String targetId = targetUserId == null ? "" : targetUserId.trim();
        if (targetId.isEmpty()) {
            throw new IllegalArgumentException("Missing user");
        }
        if (targetId.equalsIgnoreCase(adminUserId.trim())) {
            throw new IllegalArgumentException("You cannot deactivate your own account from the admin console.");
        }
        UserEntity target = repo.findById(targetId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (target.getRole() != UserRole.DOCTOR) {
            throw new IllegalArgumentException("Only doctor accounts can be deactivated through this admin action.");
        }
        applyDeactivation(target);
        repo.save(target);
    }

    private static void applyDeactivation(UserEntity user) {
        user.setActive(false);
        user.setRoleStatus(RoleRequestStatus.INACTIVE);
        user.setTokenVersion(user.getTokenVersion() + 1L);
        user.setUpdatedTimestamp(Instant.now());
    }

    private RegisterResponse toRegisterResponse(UserEntity saved) {
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
                saved.getRole() == null ? UserRole.PATIENT.name() : saved.getRole().name(),
                saved.getRoleStatus() == null ? RoleRequestStatus.ACTIVE.name() : saved.getRoleStatus().name(),
                saved.getRequestedRole() == null ? null : saved.getRequestedRole().name(),
                saved.getRoleRejectedReason());
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String mergeTrim(String incoming, String existing) {
        if (incoming == null) {
            return nz(existing).trim();
        }
        return incoming.trim();
    }

    private static String buildDisplayName(String firstName, String lastName) {
        String f = firstName == null ? "" : firstName.trim();
        String l = lastName == null ? "" : lastName.trim();
        String joined = (f + " " + l).trim();
        return joined.isEmpty() ? "User" : joined;
    }
}
