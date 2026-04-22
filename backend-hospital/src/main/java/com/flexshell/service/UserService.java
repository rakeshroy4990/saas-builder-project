package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
public class UserService {
    private final ObjectProvider<UserRepository> userRepositoryProvider;

    public UserService(ObjectProvider<UserRepository> userRepositoryProvider) {
        this.userRepositoryProvider = userRepositoryProvider;
    }

    public Optional<RegisterResponse> getByUserId(String actorUserId) {
        UserRepository repo = userRepositoryProvider.getIfAvailable();
        if (repo == null || actorUserId == null || actorUserId.isBlank()) {
            return Optional.empty();
        }
        return repo.findById(actorUserId.trim()).map(this::toRegisterResponse);
    }

    public RegisterResponse updateProfile(String actorUserId, RegisterRequest request) {
        UserRepository repo = userRepositoryProvider.getIfAvailable();
        if (repo == null) {
            throw new IllegalStateException("User repository unavailable");
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
            if (request.getQualifications() != null) {
                user.setQualifications(request.getQualifications().trim());
            }
            if (request.getSmcName() != null) {
                user.setSmcName(request.getSmcName().trim());
            }
            if (request.getSmcRegistrationNumber() != null) {
                user.setSmcRegistrationNumber(request.getSmcRegistrationNumber().trim());
            }
            String q = user.getQualifications() == null ? "" : user.getQualifications().trim();
            String smc = user.getSmcName() == null ? "" : user.getSmcName().trim();
            String reg = user.getSmcRegistrationNumber() == null ? "" : user.getSmcRegistrationNumber().trim();
            if (q.isEmpty() || smc.isEmpty() || reg.isEmpty()) {
                throw new IllegalArgumentException(
                        "Qualifications, State Medical Council, and SMC registration number are required for doctor accounts.");
            }
        }

        user.setUsername(buildDisplayName(user.getFirstName(), user.getLastName()));
        user.setUpdatedTimestamp(Instant.now());
        UserEntity saved = repo.save(user);
        return toRegisterResponse(saved);
    }

    public void deactivateAccount(String actorUserId) {
        UserRepository repo = userRepositoryProvider.getIfAvailable();
        if (repo == null) {
            throw new IllegalStateException("User repository unavailable");
        }
        String id = actorUserId == null ? "" : actorUserId.trim();
        if (id.isEmpty()) {
            throw new IllegalArgumentException("Missing user");
        }
        UserEntity user = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setActive(false);
        user.setRoleStatus(RoleRequestStatus.INACTIVE);
        user.setTokenVersion(user.getTokenVersion() + 1L);
        user.setUpdatedTimestamp(Instant.now());
        repo.save(user);
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
