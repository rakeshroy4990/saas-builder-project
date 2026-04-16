package com.flexshell.service;

import com.flexshell.auth.JwtService;
import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.auth.RefreshTokenRepository;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.api.AuthFacade;
import com.flexshell.auth.api.AuthApiException;
import com.flexshell.auth.api.LoginResponse;
import com.flexshell.auth.api.LogoutRequest;
import com.flexshell.auth.api.RefreshTokenRequest;
import com.flexshell.auth.api.RefreshTokenResponse;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService implements AuthFacade {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final int PRIVILEGED_REQUEST_LIMIT = 5;
    private static final long PRIVILEGED_REQUEST_WINDOW_SECONDS = 600L;
    private final ObjectProvider<UserRepository> userRepositoryProvider;
    private final ObjectProvider<RefreshTokenRepository> refreshTokenRepositoryProvider;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, PrivilegedRequestAttempt> privilegedRequestAttempts = new ConcurrentHashMap<>();

    private record PrivilegedRequestAttempt(int count, Instant windowStart) {
    }

    public AuthService(
            ObjectProvider<UserRepository> userRepositoryProvider,
            ObjectProvider<RefreshTokenRepository> refreshTokenRepositoryProvider,
            JwtService jwtService
    ) {
        this.userRepositoryProvider = userRepositoryProvider;
        this.refreshTokenRepositoryProvider = refreshTokenRepositoryProvider;
        this.jwtService = jwtService;
    }

    public Optional<LoginResponse> login(String usernameOrEmail, String rawPassword) {
        String identity = usernameOrEmail == null ? "" : usernameOrEmail.trim();
        if (identity.isEmpty() || rawPassword == null || rawPassword.isBlank()) return Optional.empty();

        UserRepository userRepository = userRepositoryProvider.getIfAvailable();
        if (userRepository == null) return Optional.empty();

        Optional<UserEntity> user = identity.contains("@")
                ? userRepository.findByEmail(identity)
                : userRepository.findByUsername(identity);
        if (user.isEmpty() || !user.get().isActive()) return Optional.empty();
        RoleRequestStatus roleStatus = user.get().getRoleStatus();
        if (RoleRequestStatus.PENDING_APPROVAL.equals(roleStatus)) {
            log.info(
                    "Login blocked due to pending role status userId={} email={} roleStatus={}",
                    user.get().getId(),
                    user.get().getEmail(),
                    roleStatus);
            throw new AuthApiException(
                    "Your request is pending for approval. Please wait for an admin to approve your request.",
                    "AUTH_ROLE_PENDING_APPROVAL");
        }
        if (!RoleRequestStatus.ACTIVE.equals(roleStatus)) {
            log.info(
                    "Login blocked due to non-active role status userId={} email={} roleStatus={}",
                    user.get().getId(),
                    user.get().getEmail(),
                    roleStatus);
            return Optional.empty();
        }

        String hash = user.get().getPasswordHash();
        if (hash == null || hash.isBlank()) return Optional.empty();
        if (!passwordEncoder.matches(rawPassword, hash)) return Optional.empty();

        String subject = user.get().getId();
        String audience = "web";
        String deviceId = "browser";
        String accessToken = jwtService.generateAccessToken(
                subject,
                audience,
                user.get().getTokenVersion(),
                user.get().getRole() == null ? UserRole.PATIENT.name() : user.get().getRole().name());
        String refreshToken = jwtService.generateRefreshToken(subject, audience, deviceId, user.get().getTokenVersion());

        RefreshTokenRepository refreshTokenRepository = refreshTokenRepositoryProvider.getIfAvailable();
        if (refreshTokenRepository == null) return Optional.empty();
        persistRefreshToken(refreshTokenRepository, user.get().getId(), refreshToken, deviceId);

        LoginResponse response = new LoginResponse(accessToken, jwtService.getAccessExpirationSeconds());
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setRefreshExpiresInSeconds(jwtService.getRefreshExpirationSeconds());
        response.setUserId(user.get().getId());
        response.setUsername(resolveDisplayName(user.get()));
        response.setEmail(user.get().getEmail());
        response.setFirstName(user.get().getFirstName());
        response.setLastName(user.get().getLastName());
        response.setAddress(user.get().getAddress());
        response.setGender(user.get().getGender());
        response.setMobileNumber(user.get().getMobileNumber());
        response.setDepartment(user.get().getDepartment());
        response.setCreatedTimestamp(
                user.get().getCreatedTimestamp() == null ? null : user.get().getCreatedTimestamp().toString());
        response.setUpdatedTimestamp(
                user.get().getUpdatedTimestamp() == null ? null : user.get().getUpdatedTimestamp().toString());
        response.setActive(user.get().isActive());
        response.setRole(user.get().getRole() == null ? UserRole.PATIENT.name() : user.get().getRole().name());
        response.setRoleStatus(user.get().getRoleStatus() == null ? RoleRequestStatus.ACTIVE.name() : user.get().getRoleStatus().name());
        response.setRequestedRole(user.get().getRequestedRole() == null ? null : user.get().getRequestedRole().name());
        response.setRoleRejectedReason(user.get().getRoleRejectedReason());
        return Optional.of(response);
    }

    @Override
    public Optional<RegisterResponse> register(RegisterRequest request) {
        UserRepository userRepository = userRepositoryProvider.getIfAvailable();
        if (userRepository == null || request == null) return Optional.empty();

        String email = request.getEmailId() == null ? "" : request.getEmailId().trim().toLowerCase();
        String firstName = request.getFirstName() == null ? "" : request.getFirstName().trim();
        String lastName = request.getLastName() == null ? "" : request.getLastName().trim();
        String rawPassword = request.getPassword() == null ? "" : request.getPassword().trim();
        String address = request.getAddress() == null ? "" : request.getAddress().trim();
        String gender = request.getGender() == null ? "" : request.getGender().trim();
        String mobileNumber = request.getMobileNumber() == null ? "" : request.getMobileNumber().trim();
        String department = request.getDepartment() == null ? "" : request.getDepartment().trim();
        UserRole requestedRole = normalizeRequestedRole(request.getRole());
        if (firstName.isEmpty() || lastName.isEmpty() || email.isEmpty() || rawPassword.isEmpty() || address.isEmpty() || gender.isEmpty() || mobileNumber.isEmpty()) {
            return Optional.empty();
        }

        if (userRepository.findByEmail(email).isPresent()) return Optional.empty();

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
        Instant now = Instant.now();
        user.setCreatedTimestamp(now);
        user.setUpdatedTimestamp(now);
        user.setActive(true);
        user.setTokenVersion(1L);
        user.setRole(UserRole.PATIENT);
        user.setRoleStatus(RoleRequestStatus.ACTIVE);

        if (isPrivilegedRole(requestedRole)) {
            if (!isPrivilegedRequestAllowed(email)) {
                log.warn("Privileged role request rate limit exceeded for email={}", email);
                return Optional.empty();
            }
            user.setRoleStatus(RoleRequestStatus.PENDING_APPROVAL);
            user.setRequestedRole(requestedRole);
            user.setRoleRequestedAt(now);
            log.info("Privileged role request created email={} requestedRole={}", email, requestedRole);
        }

        UserEntity saved = userRepository.save(user);
        return Optional.of(new RegisterResponse(
                saved.getId(),
                saved.getEmail(),
                saved.getFirstName(),
                saved.getLastName(),
                rawPassword,
                saved.getAddress(),
                saved.getGender(),
                saved.getMobileNumber(),
                saved.getDepartment(),
                saved.getCreatedTimestamp() == null ? null : saved.getCreatedTimestamp().toString(),
                saved.getUpdatedTimestamp() == null ? null : saved.getUpdatedTimestamp().toString(),
                saved.getRole() == null ? UserRole.PATIENT.name() : saved.getRole().name(),
                saved.getRoleStatus() == null ? RoleRequestStatus.ACTIVE.name() : saved.getRoleStatus().name(),
                saved.getRequestedRole() == null ? null : saved.getRequestedRole().name(),
                saved.getRoleRejectedReason()));
    }

    @Override
    public Optional<RefreshTokenResponse> refresh(RefreshTokenRequest request) {
        UserRepository userRepository = userRepositoryProvider.getIfAvailable();
        RefreshTokenRepository refreshTokenRepository = refreshTokenRepositoryProvider.getIfAvailable();
        if (userRepository == null || refreshTokenRepository == null || request == null) return Optional.empty();

        String suppliedRefreshToken = request.getRefreshToken() == null ? "" : request.getRefreshToken().trim();
        if (suppliedRefreshToken.isEmpty()) return Optional.empty();

        Optional<RefreshTokenEntity> tokenEntityOptional = refreshTokenRepository.findByToken(suppliedRefreshToken);
        if (tokenEntityOptional.isEmpty()) {
            log.warn("Refresh token replay or invalid token attempt");
            return Optional.empty();
        }
        RefreshTokenEntity tokenEntity = tokenEntityOptional.get();
        if (tokenEntity.getExpiry() == null || tokenEntity.getExpiry().isBefore(Instant.now())) {
            refreshTokenRepository.delete(tokenEntity);
            log.warn("Expired refresh token usage for userId={}", tokenEntity.getUserId());
            return Optional.empty();
        }

        String deviceId = request.getDeviceId() == null ? "" : request.getDeviceId().trim();
        if (!deviceId.isEmpty() && tokenEntity.getDeviceId() != null && !deviceId.equals(tokenEntity.getDeviceId())) {
            log.warn("Refresh token device mismatch userId={} expectedDevice={} actualDevice={}",
                    tokenEntity.getUserId(), tokenEntity.getDeviceId(), deviceId);
            return Optional.empty();
        }

        final Claims refreshClaims;
        try {
            refreshClaims = jwtService.parseAndValidate(suppliedRefreshToken);
        } catch (JwtException | IllegalArgumentException ex) {
            log.warn("Invalid refresh token signature/issuer");
            refreshTokenRepository.delete(tokenEntity);
            return Optional.empty();
        }
        if (!"refresh".equalsIgnoreCase(refreshClaims.get("tokenType", String.class))) {
            log.warn("Non-refresh token supplied to refresh endpoint");
            return Optional.empty();
        }
        if (refreshClaims.getAudience() == null || !refreshClaims.getAudience().contains("web")) {
            log.warn("Refresh token audience mismatch");
            return Optional.empty();
        }
        String refreshSubject = refreshClaims.getSubject();
        if (refreshSubject == null || !refreshSubject.equals(tokenEntity.getUserId())) {
            log.warn("Refresh token subject mismatch");
            return Optional.empty();
        }

        Optional<UserEntity> userOptional = userRepository.findById(tokenEntity.getUserId());
        if (userOptional.isEmpty() || !userOptional.get().isActive()) return Optional.empty();
        UserEntity user = userOptional.get();
        Number tokenVersionClaim = refreshClaims.get("tokenVersion", Number.class);
        long tokenVersion = tokenVersionClaim == null ? 0L : tokenVersionClaim.longValue();
        if (tokenVersion != user.getTokenVersion()) {
            log.warn("Refresh token version mismatch userId={}", user.getId());
            return Optional.empty();
        }

        String audience = "web";
        String newAccessToken = jwtService.generateAccessToken(
                user.getId(),
                audience,
                user.getTokenVersion(),
                user.getRole() == null ? UserRole.PATIENT.name() : user.getRole().name());
        String newRefreshToken = jwtService.generateRefreshToken(
                user.getId(),
                audience,
                tokenEntity.getDeviceId(),
                user.getTokenVersion());

        // Rotation: old refresh token is removed before the new one is inserted.
        refreshTokenRepository.delete(tokenEntity);
        persistRefreshToken(refreshTokenRepository, user.getId(), newRefreshToken, tokenEntity.getDeviceId());
        log.info("Refresh token rotated for userId={}", user.getId());

        return Optional.of(new RefreshTokenResponse(
                newAccessToken,
                jwtService.getAccessExpirationSeconds(),
                newRefreshToken,
                jwtService.getRefreshExpirationSeconds()));
    }

    @Override
    public boolean logout(LogoutRequest request) {
        RefreshTokenRepository refreshTokenRepository = refreshTokenRepositoryProvider.getIfAvailable();
        if (refreshTokenRepository == null || request == null) return false;

        String suppliedRefreshToken = request.getRefreshToken() == null ? "" : request.getRefreshToken().trim();
        if (suppliedRefreshToken.isEmpty()) return false;

        Optional<RefreshTokenEntity> tokenEntityOptional = refreshTokenRepository.findByToken(suppliedRefreshToken);
        if (tokenEntityOptional.isEmpty()) return false;
        RefreshTokenEntity tokenEntity = tokenEntityOptional.get();

        String deviceId = request.getDeviceId() == null ? "" : request.getDeviceId().trim();
        if (!deviceId.isEmpty() && tokenEntity.getDeviceId() != null && !deviceId.equals(tokenEntity.getDeviceId())) {
            log.warn("Logout device mismatch userId={} expectedDevice={} actualDevice={}",
                    tokenEntity.getUserId(), tokenEntity.getDeviceId(), deviceId);
            return false;
        }

        refreshTokenRepository.delete(tokenEntity);
        return true;
    }

    private void persistRefreshToken(
            RefreshTokenRepository refreshTokenRepository,
            String userId,
            String token,
            String deviceId
    ) {
        RefreshTokenEntity tokenEntity = new RefreshTokenEntity();
        tokenEntity.setUserId(userId);
        tokenEntity.setToken(token);
        tokenEntity.setDeviceId(deviceId);
        tokenEntity.setCreatedAt(Instant.now());
        tokenEntity.setExpiry(Instant.now().plusSeconds(jwtService.getRefreshExpirationSeconds()));
        refreshTokenRepository.save(tokenEntity);
    }

    private UserRole normalizeRequestedRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            return UserRole.PATIENT;
        }
        try {
            return UserRole.valueOf(rawRole.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return UserRole.PATIENT;
        }
    }

    private boolean isPrivilegedRole(UserRole role) {
        return role == UserRole.DOCTOR || role == UserRole.ADMIN;
    }

    private boolean isPrivilegedRequestAllowed(String email) {
        String key = email == null ? "unknown" : email.trim().toLowerCase();
        Instant now = Instant.now();
        PrivilegedRequestAttempt current = privilegedRequestAttempts.get(key);
        if (current == null || now.isAfter(current.windowStart().plusSeconds(PRIVILEGED_REQUEST_WINDOW_SECONDS))) {
            privilegedRequestAttempts.put(key, new PrivilegedRequestAttempt(1, now));
            return true;
        }
        if (current.count() >= PRIVILEGED_REQUEST_LIMIT) {
            return false;
        }
        privilegedRequestAttempts.put(key, new PrivilegedRequestAttempt(current.count() + 1, current.windowStart()));
        return true;
    }

    private String resolveDisplayName(UserEntity user) {
        String explicitName = buildDisplayName(user.getFirstName(), user.getLastName());
        if (!explicitName.isBlank()) {
            return explicitName;
        }
        String username = user.getUsername() == null ? "" : user.getUsername().trim();
        if (!username.isBlank() && !username.contains("@")) {
            return username;
        }
        return deriveDisplayNameFromEmail(user.getEmail());
    }

    private String buildDisplayName(String firstName, String lastName) {
        String first = firstName == null ? "" : firstName.trim();
        String last = lastName == null ? "" : lastName.trim();
        String combined = (first + " " + last).trim();
        return combined;
    }

    private String deriveDisplayNameFromEmail(String email) {
        String normalized = email == null ? "" : email.trim();
        if (normalized.isBlank()) {
            return "User";
        }
        String localPart = normalized.contains("@") ? normalized.substring(0, normalized.indexOf('@')) : normalized;
        String[] parts = localPart.split("[._-]+");
        StringBuilder builder = new StringBuilder();
        for (String raw : parts) {
            String token = raw == null ? "" : raw.trim();
            if (token.isBlank()) continue;
            if (!builder.isEmpty()) builder.append(' ');
            builder.append(Character.toUpperCase(token.charAt(0)));
            if (token.length() > 1) {
                builder.append(token.substring(1));
            }
        }
        return builder.isEmpty() ? "User" : builder.toString();
    }
}

