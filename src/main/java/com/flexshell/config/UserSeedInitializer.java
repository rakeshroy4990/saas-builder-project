package com.flexshell.config;

import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
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
import java.util.Optional;

@Component
@ConditionalOnBean(UserRepository.class)
public class UserSeedInitializer {
    private static final Logger log = LoggerFactory.getLogger(UserSeedInitializer.class);
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final boolean enabled;
    private final String seedPassword;

    public UserSeedInitializer(
            UserRepository userRepository,
            @Value("${app.seed.users.enabled:false}") boolean enabled,
            @Value("${app.seed.users.default-password:ChangeMe123!}") String seedPassword
    ) {
        this.userRepository = userRepository;
        this.enabled = enabled;
        this.seedPassword = seedPassword;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seedUsers() {
        if (!enabled) {
            return;
        }
        seedAdmin("admin.one@hospital.local", "Admin", "One");
        seedAdmin("admin.two@hospital.local", "Admin", "Two");
        seedPatientWithPendingDoctorRequest("doctor.request@hospital.local", "Doctor", "Request");
        seedPatient("patient.one@hospital.local", "Patient", "One");
        log.info("Default seed users ensured successfully");
    }

    private void seedAdmin(String email, String firstName, String lastName) {
        Optional<UserEntity> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            return;
        }
        UserEntity admin = buildBaseUser(email, firstName, lastName);
        admin.setRole(UserRole.ADMIN);
        admin.setRoleStatus(RoleRequestStatus.ACTIVE);
        userRepository.save(admin);
        log.info("Seeded admin user email={}", email);
    }

    private void seedPatientWithPendingDoctorRequest(String email, String firstName, String lastName) {
        Optional<UserEntity> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            return;
        }
        UserEntity user = buildBaseUser(email, firstName, lastName);
        user.setRole(UserRole.PATIENT);
        user.setRoleStatus(RoleRequestStatus.PENDING_APPROVAL);
        user.setRequestedRole(UserRole.DOCTOR);
        user.setRoleRequestedAt(Instant.now());
        userRepository.save(user);
        log.info("Seeded pending doctor role request email={}", email);
    }

    private void seedPatient(String email, String firstName, String lastName) {
        Optional<UserEntity> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            return;
        }
        UserEntity user = buildBaseUser(email, firstName, lastName);
        user.setRole(UserRole.PATIENT);
        user.setRoleStatus(RoleRequestStatus.ACTIVE);
        userRepository.save(user);
        log.info("Seeded patient user email={}", email);
    }

    private UserEntity buildBaseUser(String email, String firstName, String lastName) {
        Instant now = Instant.now();
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setUsername((firstName + " " + lastName).trim());
        user.setPasswordHash(passwordEncoder.encode(seedPassword));
        user.setAddress("Seeded Address");
        user.setGender("Unknown");
        user.setMobileNumber("9000000000");
        user.setCreatedTimestamp(now);
        user.setUpdatedTimestamp(now);
        user.setActive(true);
        user.setTokenVersion(1L);
        return user;
    }
}
