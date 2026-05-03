package com.flexshell.config;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@ConditionalOnBean(UserAccess.class)
public class AdminBootstrapInitializer {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapInitializer.class);
    private final UserAccess userAccess;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final boolean enabled;
    private final String email;
    private final String password;
    private final String firstName;
    private final String lastName;

    public AdminBootstrapInitializer(
            UserAccess userAccess,
            @Value("${app.bootstrap.admin.enabled:false}") boolean enabled,
            @Value("${app.bootstrap.admin.email:}") String email,
            @Value("${app.bootstrap.admin.password:}") String password,
            @Value("${app.bootstrap.admin.first-name:System}") String firstName,
            @Value("${app.bootstrap.admin.last-name:Admin}") String lastName
    ) {
        this.userAccess = userAccess;
        this.enabled = enabled;
        this.email = email;
        this.password = password;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void bootstrapFirstAdmin() {
        if (!enabled) {
            return;
        }
        if (userAccess.countByRole(UserRole.ADMIN) > 0) {
            log.info("Admin bootstrap skipped: existing admin found");
            return;
        }
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        String normalizedPassword = password == null ? "" : password.trim();
        if (normalizedEmail.isBlank() || normalizedPassword.isBlank()) {
            log.warn("Admin bootstrap enabled but credentials are missing");
            return;
        }

        Instant now = Instant.now();
        UserEntity admin = new UserEntity();
        admin.setEmail(normalizedEmail);
        admin.setFirstName(firstName == null ? "System" : firstName.trim());
        admin.setLastName(lastName == null ? "Admin" : lastName.trim());
        admin.setUsername((admin.getFirstName() + " " + admin.getLastName()).trim());
        admin.setPasswordHash(passwordEncoder.encode(normalizedPassword));
        admin.setAddress("Bootstrap");
        admin.setGender("Unknown");
        admin.setMobileNumber("0000000000");
        admin.setCreatedTimestamp(now);
        admin.setUpdatedTimestamp(now);
        admin.setActive(true);
        admin.setTokenVersion(1L);
        admin.setRole(UserRole.ADMIN);
        admin.setRoleStatus(RoleRequestStatus.ACTIVE);
        userAccess.save(admin);
        log.info("Bootstrap admin user created for email={}", normalizedEmail);
    }
}
