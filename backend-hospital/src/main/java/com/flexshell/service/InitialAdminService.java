package com.flexshell.service;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.controller.dto.CreateInitialAdminRequest;
import com.flexshell.controller.dto.CreateInitialAdminResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class InitialAdminService {
    private static final Logger log = LoggerFactory.getLogger(InitialAdminService.class);
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public InitialAdminService(ObjectProvider<UserAccess> userAccessProvider) {
        this.userAccessProvider = userAccessProvider;
    }

    public CreateInitialAdminResponse createInitialAdmin(CreateInitialAdminRequest request) {
        UserAccess users = requireRepository();
        if (users.countByRole(UserRole.ADMIN) > 0) {
            throw new IllegalStateException("Admin already exists");
        }
        String email = request.getEmail().trim().toLowerCase();
        if (users.findByEmail(email).isPresent()) {
            throw new IllegalStateException("User with this email already exists");
        }
        Instant now = Instant.now();
        UserEntity admin = new UserEntity();
        admin.setEmail(email);
        admin.setFirstName(request.getFirstName().trim());
        admin.setLastName(request.getLastName().trim());
        admin.setUsername((admin.getFirstName() + " " + admin.getLastName()).trim());
        admin.setPasswordHash(passwordEncoder.encode(request.getPassword().trim()));
        admin.setAddress("Initial admin");
        admin.setGender("Unknown");
        admin.setMobileNumber("0000000000");
        admin.setCreatedTimestamp(now);
        admin.setUpdatedTimestamp(now);
        admin.setActive(true);
        admin.setTokenVersion(1L);
        admin.setRole(UserRole.ADMIN);
        admin.setRoleStatus(RoleRequestStatus.ACTIVE);
        admin.setRequestedRole(null);
        admin.setRoleRejectedReason(null);
        UserEntity saved = users.save(admin);
        log.info("Initial admin created userId={} email={}", saved.getId(), saved.getEmail());
        return new CreateInitialAdminResponse(
                saved.getId(),
                saved.getEmail(),
                saved.getRole().name(),
                saved.getRoleStatus().name());
    }

    private UserAccess requireRepository() {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) {
            throw new IllegalStateException("User persistence is unavailable");
        }
        return users;
    }
}
