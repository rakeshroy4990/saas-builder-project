package com.flexshell.service;

import com.flexshell.auth.JwtService;
import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRole;
import com.flexshell.persistence.api.RefreshTokenAccess;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.api.AuthFacade;
import com.flexshell.auth.api.AuthApiException;
import com.flexshell.auth.api.ChangePasswordRequest;
import com.flexshell.auth.api.LoginResponse;
import com.flexshell.auth.api.LogoutRequest;
import com.flexshell.auth.api.RefreshTokenRequest;
import com.flexshell.auth.api.RefreshTokenResponse;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.email.AppEmailProperties;
import com.flexshell.security.PasswordPolicy;
import com.flexshell.observability.ObservabilityLogger;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService implements AuthFacade {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final int PRIVILEGED_REQUEST_LIMIT = 5;
    private static final long PRIVILEGED_REQUEST_WINDOW_SECONDS = 600L;
    private final ObjectProvider<UserAccess> userAccessProvider;
    private final ObjectProvider<RefreshTokenAccess> refreshTokenAccessProvider;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final Map<String, PrivilegedRequestAttempt> privilegedRequestAttempts = new ConcurrentHashMap<>();
    private final AppEmailProperties appEmailProperties;
    private final PasswordPolicy passwordPolicy;

    private record PrivilegedRequestAttempt(int count, Instant windowStart) {
    }

    /**
     * Verified Google userinfo used to provision or match a local {@link UserEntity}.
     * {@code gender} / {@code mobileNumber} may be empty when Google does not return them for the granted scopes.
     */
    private record GoogleVerifiedProfile(String email, String givenName, String familyName, String gender, String mobileNumber) {
    }

    public AuthService(
            ObjectProvider<UserAccess> userAccessProvider,
            ObjectProvider<RefreshTokenAccess> refreshTokenAccessProvider,
            JwtService jwtService,
            AppEmailProperties appEmailProperties,
            PasswordPolicy passwordPolicy
    ) {
        this.userAccessProvider = userAccessProvider;
        this.refreshTokenAccessProvider = refreshTokenAccessProvider;
        this.jwtService = jwtService;
        this.appEmailProperties = appEmailProperties;
        this.passwordPolicy = passwordPolicy;
    }

    public Optional<LoginResponse> login(String usernameOrEmail, String rawPassword) {
        String identity = usernameOrEmail == null ? "" : usernameOrEmail.trim();
        if (identity.isEmpty() || rawPassword == null || rawPassword.isBlank()) return Optional.empty();

        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) return Optional.empty();

        Optional<UserEntity> user = identity.contains("@")
                ? users.findByEmail(identity)
                : users.findByUsername(identity);
        if (user.isEmpty()) {
            ObservabilityLogger.warn(log, "login_attempt", Map.of(
                    "domain", "auth",
                    "status", "fail",
                    "reason_code", "invalid_credentials",
                    "identity_hint", identity.contains("@") ? "email" : "username"));
            return Optional.empty();
        }
        UserEntity account = user.get();
        if (!assertEligibleForSignIn(account)) {
            return Optional.empty();
        }

        String hash = account.getPasswordHash();
        if (hash == null || hash.isBlank()) {
            ObservabilityLogger.warn(log, "login_attempt", Map.of(
                    "domain", "auth",
                    "status", "fail",
                    "reason_code", "invalid_credentials",
                    "user_id", account.getId()));
            return Optional.empty();
        }
        if (!passwordEncoder.matches(rawPassword, hash)) {
            ObservabilityLogger.warn(log, "login_attempt", Map.of(
                    "domain", "auth",
                    "status", "fail",
                    "reason_code", "invalid_credentials",
                    "user_id", account.getId()));
            return Optional.empty();
        }

        return completeLoginWithTokens(account, "login_attempt");
    }

    @Override
    public Optional<LoginResponse> loginWithGoogleAccessToken(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) return Optional.empty();
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null) return Optional.empty();

        Optional<GoogleVerifiedProfile> profileOpt = fetchVerifiedGoogleProfile(accessToken.trim());
        if (profileOpt.isEmpty()) return Optional.empty();
        GoogleVerifiedProfile profile = profileOpt.get();

        Optional<UserEntity> existing = findUserByEmailCaseInsensitive(users, profile.email());
        UserEntity account;
        if (existing.isPresent()) {
            account = enrichUserFromGoogleProfileIfMissing(users, existing.get(), profile);
        } else {
            try {
                account = provisionPatientFromGoogle(users, profile);
                log.info("Created patient user from Google sign-in email={}", profile.email());
            } catch (DataIntegrityViolationException ex) {
                account = findUserByEmailCaseInsensitive(users, profile.email()).orElse(null);
                if (account == null) {
                    log.warn("Google sign-in duplicate key but user not found email={}", profile.email());
                    return Optional.empty();
                }
            }
        }
        if (!assertEligibleForSignIn(account)) {
            return Optional.empty();
        }
        return completeLoginWithTokens(account, "google_login_attempt");
    }

    /**
     * @return {@code false} when sign-in must fail without throwing (unknown/blocked role).
     */
    private boolean assertEligibleForSignIn(UserEntity account) {
        RoleRequestStatus roleStatus = account.getRoleStatus() == null ? RoleRequestStatus.ACTIVE : account.getRoleStatus();

        if (!account.isActive() || RoleRequestStatus.INACTIVE.equals(roleStatus)) {
            log.info(
                    "Login blocked deactivated userId={} email={} active={} roleStatus={}",
                    account.getId(),
                    account.getEmail(),
                    account.isActive(),
                    roleStatus);
            throw new AuthApiException(
                    "Your account has been deactivated. You cannot sign in until an administrator reactivates your account.",
                    "AUTH_ACCOUNT_DEACTIVATED");
        }
        if (RoleRequestStatus.PENDING_APPROVAL.equals(roleStatus)) {
            log.info(
                    "Login blocked due to pending role status userId={} email={} roleStatus={}",
                    account.getId(),
                    account.getEmail(),
                    roleStatus);
            throw new AuthApiException(
                    "Your request is pending for approval. Please wait for an admin to approve your request.",
                    "AUTH_ROLE_PENDING_APPROVAL");
        }
        if (!RoleRequestStatus.ACTIVE.equals(roleStatus)) {
            log.info(
                    "Login blocked due to non-active role status userId={} email={} roleStatus={}",
                    account.getId(),
                    account.getEmail(),
                    roleStatus);
            return false;
        }
        return true;
    }

    private Optional<LoginResponse> completeLoginWithTokens(UserEntity account, String telemetryEvent) {
        String subject = account.getId();
        String audience = "web";
        String deviceId = "browser";
        String accessToken = jwtService.generateAccessToken(
                subject,
                audience,
                account.getTokenVersion(),
                account.getRole() == null ? UserRole.PATIENT.name() : account.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(subject, audience, deviceId, account.getTokenVersion());

        RefreshTokenAccess refreshTokens = refreshTokenAccessProvider.getIfAvailable();
        if (refreshTokens == null) return Optional.empty();
        persistRefreshToken(refreshTokens, account.getId(), refreshToken, deviceId);

        LoginResponse response = new LoginResponse(accessToken, jwtService.getAccessExpirationSeconds());
        response.setAccessToken(accessToken);
        response.setRefreshToken(refreshToken);
        response.setRefreshExpiresInSeconds(jwtService.getRefreshExpirationSeconds());
        response.setUserId(account.getId());
        response.setUsername(resolveDisplayName(account));
        response.setEmail(account.getEmail());
        response.setFirstName(account.getFirstName());
        response.setLastName(account.getLastName());
        response.setAddress(account.getAddress());
        response.setGender(account.getGender());
        response.setMobileNumber(account.getMobileNumber());
        response.setDepartment(account.getDepartment());
        response.setQualifications(account.getQualifications() == null ? "" : account.getQualifications());
        response.setSmcName(account.getSmcName() == null ? "" : account.getSmcName());
        response.setSmcRegistrationNumber(
                account.getSmcRegistrationNumber() == null ? "" : account.getSmcRegistrationNumber());
        response.setCreatedTimestamp(
                account.getCreatedTimestamp() == null ? null : account.getCreatedTimestamp().toString());
        response.setUpdatedTimestamp(
                account.getUpdatedTimestamp() == null ? null : account.getUpdatedTimestamp().toString());
        response.setActive(account.isActive());
        response.setRole(account.getRole() == null ? UserRole.PATIENT.name() : account.getRole().name());
        response.setRoleStatus(account.getRoleStatus() == null ? RoleRequestStatus.ACTIVE.name() : account.getRoleStatus().name());
        response.setRequestedRole(account.getRequestedRole() == null ? null : account.getRequestedRole().name());
        response.setRoleRejectedReason(account.getRoleRejectedReason());
        ObservabilityLogger.info(log, telemetryEvent, Map.of(
                "domain", "auth",
                "status", "success",
                "reason_code", "login_success",
                "user_id", account.getId(),
                "role", response.getRole()));
        return Optional.of(response);
    }

    private Optional<GoogleVerifiedProfile> fetchVerifiedGoogleProfile(String googleAccessToken) {
        try {
            Map<String, Object> body = RestClient.create()
                    .get()
                    .uri("https://www.googleapis.com/oauth2/v3/userinfo")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + googleAccessToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (body == null) return Optional.empty();
            Object rawEmail = body.get("email");
            String email = rawEmail == null ? "" : String.valueOf(rawEmail).trim().toLowerCase();
            if (email.isEmpty()) return Optional.empty();
            if (!isGoogleEmailClaimVerified(body)) {
                log.warn("Google login rejected: email not verified by Google (email_verified / verified_email)");
                return Optional.empty();
            }
            String givenName = mapStringField(body, "given_name");
            String familyName = mapStringField(body, "family_name");
            String fullName = mapStringField(body, "name");
            if (givenName.isEmpty() && familyName.isEmpty() && !fullName.isEmpty()) {
                String[] parts = fullName.trim().split("\\s+", 2);
                givenName = parts[0].trim();
                familyName = parts.length > 1 ? parts[1].trim() : "";
            }
            Map<String, Object> merged = new HashMap<>(body);
            mergeOpenIdUserInfo(googleAccessToken, merged);
            mergePeopleMeIfNeeded(googleAccessToken, merged);
            String gender = sanitizeGoogleGender(mapStringField(merged, "gender"));
            String mobileNumber = extractGooglePhone(merged);
            return Optional.of(new GoogleVerifiedProfile(email, givenName, familyName, gender, mobileNumber));
        } catch (RestClientException ex) {
            log.warn("Google userinfo request failed: {}", ex.toString());
            return Optional.empty();
        }
    }

    /**
     * Merges optional claims from the OIDC userinfo endpoint when they are absent on the v3 payload
     * (e.g. {@code phone_number} when the token includes the right scopes).
     */
    private void mergeOpenIdUserInfo(String accessToken, Map<String, Object> merged) {
        try {
            Map<String, Object> v1 = RestClient.create()
                    .get()
                    .uri("https://openidconnect.googleapis.com/v1/userinfo")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (v1 == null) {
                return;
            }
            for (String key : List.of("gender", "phone_number", "phoneNumber", "formatted_phone_number")) {
                if (!v1.containsKey(key)) {
                    continue;
                }
                Object val = v1.get(key);
                if (val == null) {
                    continue;
                }
                if (!merged.containsKey(key) || mapStringField(merged, key).isEmpty()) {
                    merged.put(key, val);
                }
            }
        } catch (RestClientException ex) {
            log.debug("Optional OpenID userinfo merge skipped: {}", ex.toString());
        }
    }

    /**
     * When granted {@code user.phonenumbers.read} / {@code user.gender.read}, People API can supply
     * phone and gender not present on standard userinfo.
     */
    private void mergePeopleMeIfNeeded(String accessToken, Map<String, Object> merged) {
        boolean needPhone = extractGooglePhone(merged).isEmpty();
        boolean needGender = mapStringField(merged, "gender").isBlank();
        if (!needPhone && !needGender) {
            return;
        }
        try {
            String json = RestClient.create()
                    .get()
                    .uri(
                            "https://people.googleapis.com/v1/people/me"
                                    + "?personFields=phoneNumbers,genders&sources=READ_SOURCE_TYPE_ACCOUNT")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(String.class);
            if (json == null || json.isBlank()) {
                return;
            }
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(json);
            if (needGender) {
                JsonNode genders = root.path("genders");
                if (genders.isArray() && !genders.isEmpty()) {
                    JsonNode first = genders.get(0);
                    String fv = first.path("formattedValue").asText("");
                    if (fv.isBlank()) {
                        fv = first.path("value").asText("");
                    }
                    if (!fv.isBlank()) {
                        merged.put("gender", fv.trim());
                    }
                }
            }
            if (needPhone) {
                JsonNode phones = root.path("phoneNumbers");
                if (phones.isArray() && !phones.isEmpty()) {
                    String val = phones.get(0).path("value").asText("");
                    if (!val.isBlank()) {
                        merged.put("phone_number", val.trim());
                    }
                }
            }
        } catch (RestClientException ex) {
            log.debug("People API merge skipped: {}", ex.toString());
        } catch (Exception ex) {
            log.debug("People API response parse skipped: {}", ex.toString());
        }
    }

    private static String extractGooglePhone(Map<String, Object> merged) {
        String p = mapStringField(merged, "phone_number");
        if (!p.isEmpty()) {
            return truncateField(p, 64);
        }
        p = mapStringField(merged, "phoneNumber");
        if (!p.isEmpty()) {
            return truncateField(p, 64);
        }
        p = mapStringField(merged, "formatted_phone_number");
        return p.isEmpty() ? "" : truncateField(p, 64);
    }

    private static String sanitizeGoogleGender(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        return truncateField(raw.trim(), 48);
    }

    private static String truncateField(String value, int maxLen) {
        if (value.length() <= maxLen) {
            return value;
        }
        return value.substring(0, maxLen);
    }

    /**
     * Fills gender / mobile from Google when the stored user row still has no meaningful values.
     */
    private UserEntity enrichUserFromGoogleProfileIfMissing(
            UserAccess users, UserEntity user, GoogleVerifiedProfile profile) {
        boolean changed = false;
        if (shouldFillGenderFromGoogle(user.getGender()) && profile.gender() != null && !profile.gender().isBlank()) {
            user.setGender(profile.gender().trim());
            changed = true;
        }
        if (isBlankMobile(user.getMobileNumber()) && profile.mobileNumber() != null && !profile.mobileNumber().isBlank()) {
            user.setMobileNumber(profile.mobileNumber().trim());
            changed = true;
        }
        if (!changed) {
            return user;
        }
        user.setUpdatedTimestamp(Instant.now());
        return users.save(user);
    }

    private static boolean shouldFillGenderFromGoogle(String current) {
        if (current == null || current.isBlank()) {
            return true;
        }
        return "unknown".equalsIgnoreCase(current.trim());
    }

    private static boolean isBlankMobile(String mobile) {
        return mobile == null || mobile.trim().isEmpty();
    }

    private static String mapStringField(Map<String, Object> body, String key) {
        Object v = body.get(key);
        if (v == null) return "";
        String s = String.valueOf(v).trim();
        return s;
    }

    /**
     * Google {@code oauth2/v3/userinfo} returns {@code email_verified}; older docs use {@code verified_email}.
     * If neither claim is present but {@code email} is, treat as verified (token was issued for this account).
     */
    private static boolean isGoogleEmailClaimVerified(Map<String, Object> body) {
        Boolean verified = firstTruthyBoolean(body.get("email_verified"), body.get("verified_email"));
        if (verified != null) {
            return verified;
        }
        return true;
    }

    /** @return {@code null} if all inputs are absent or not parseable as boolean */
    private static Boolean firstTruthyBoolean(Object... rawValues) {
        for (Object raw : rawValues) {
            if (raw == null) {
                continue;
            }
            if (raw instanceof Boolean b) {
                return b;
            }
            if (raw instanceof Number n) {
                return n.intValue() != 0;
            }
            String s = String.valueOf(raw).trim();
            if (s.isEmpty()) {
                continue;
            }
            if ("true".equalsIgnoreCase(s)) {
                return true;
            }
            if ("false".equalsIgnoreCase(s)) {
                return false;
            }
        }
        return null;
    }

    private static Optional<UserEntity> findUserByEmailCaseInsensitive(UserAccess repo, String emailNorm) {
        if (emailNorm == null || emailNorm.isBlank()) {
            return Optional.empty();
        }
        Optional<UserEntity> exact = repo.findByEmail(emailNorm);
        if (exact.isPresent()) {
            return exact;
        }
        return repo.findByEmailIgnoreCase(emailNorm);
    }

    /**
     * Inserts a new active patient account for a first-time Google sign-in. Password login remains
     * unavailable until the user sets a password through the normal password flow.
     */
    private UserEntity provisionPatientFromGoogle(UserAccess users, GoogleVerifiedProfile profile) {
        String firstName = profile.givenName() == null ? "" : profile.givenName().trim();
        String lastName = profile.familyName() == null ? "" : profile.familyName().trim();
        if (firstName.isEmpty() && lastName.isEmpty()) {
            String derived = deriveDisplayNameFromEmail(profile.email());
            String[] tokens = derived.split("\\s+", 2);
            firstName = tokens[0].trim();
            lastName = tokens.length > 1 ? tokens[1].trim() : "";
        }
        if (firstName.isEmpty()) {
            firstName = "User";
        }

        UserEntity user = new UserEntity();
        user.setEmail(profile.email());
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setUsername(buildDisplayName(firstName, lastName));
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setAddress("");
        String genderVal =
                profile.gender() == null || profile.gender().isBlank() ? "Unknown" : profile.gender().trim();
        String mobileVal = profile.mobileNumber() == null ? "" : profile.mobileNumber().trim();
        user.setGender(genderVal);
        user.setMobileNumber(mobileVal);
        user.setDepartment("");
        user.setQualifications("");
        user.setSmcName("");
        user.setSmcRegistrationNumber("");
        Instant now = Instant.now();
        user.setCreatedTimestamp(now);
        user.setUpdatedTimestamp(now);
        user.setActive(true);
        user.setTokenVersion(1L);
        user.setRole(UserRole.PATIENT);
        user.setRoleStatus(RoleRequestStatus.ACTIVE);
        return users.save(user);
    }

    @Override
    public Optional<RegisterResponse> register(RegisterRequest request) {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null || request == null) return Optional.empty();

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

        passwordPolicy.validateOrThrow(rawPassword);

        Optional<UserEntity> existingOpt = users.findByEmail(email);
        if (existingOpt.isPresent()) {
            UserEntity existing = existingOpt.get();
            if (!existing.isActive() || RoleRequestStatus.INACTIVE.equals(existing.getRoleStatus())) {
                throw new AuthApiException(
                        "Your account is already inactive. You cannot register again with this email address until an administrator reactivates your account.",
                        "AUTH_ACCOUNT_INACTIVE");
            }
            throw new AuthApiException(
                    "An account already exists for this email address.",
                    "AUTH_ACCOUNT_EXISTS");
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

        UserEntity saved = users.save(user);
        sendWelcomeRegistrationEmail(saved);
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
                saved.getQualifications(),
                saved.getSmcName(),
                saved.getSmcRegistrationNumber(),
                saved.getCreatedTimestamp() == null ? null : saved.getCreatedTimestamp().toString(),
                saved.getUpdatedTimestamp() == null ? null : saved.getUpdatedTimestamp().toString(),
                saved.getRole() == null ? UserRole.PATIENT.name() : saved.getRole().name(),
                saved.getRoleStatus() == null ? RoleRequestStatus.ACTIVE.name() : saved.getRoleStatus().name(),
                saved.getRequestedRole() == null ? null : saved.getRequestedRole().name(),
                saved.getRoleRejectedReason()));
    }

    private void sendWelcomeRegistrationEmail(UserEntity user) {
        if (user == null) {
            return;
        }
        if (!appEmailProperties.isEnabled()) {
            return;
        }
        String baseUrl = appEmailProperties.getInternalBaseUrl() == null ? "" : appEmailProperties.getInternalBaseUrl().trim();
        if (baseUrl.isEmpty()) {
            return;
        }
        String secret = appEmailProperties.getInternalSecret() == null ? "" : appEmailProperties.getInternalSecret().trim();
        String email = user.getEmail() == null ? "" : user.getEmail().trim();
        if (email.isEmpty()) {
            return;
        }
        String fullName = buildDisplayName(user.getFirstName(), user.getLastName());
        String userName = fullName.isBlank() ? resolveDisplayName(user) : fullName;
        try {
            RestClient client = RestClient.create(baseUrl);
            client.post()
                    .uri("/hospital/welcome-registration")
                    .headers(headers -> {
                        if (!secret.isEmpty()) {
                            headers.set("X-Email-Internal-Secret", secret);
                        }
                    })
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "email", email,
                            "userName", userName
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            log.warn("Welcome email HTTP error for userId={} status={} message={}",
                    user.getId(),
                    ex.getStatusCode().value(),
                    ex.getStatusText());
        } catch (RestClientException ex) {
            log.warn("Welcome email failed for userId={}: {}", user.getId(), ex.getMessage());
        }
    }

    @Override
    public void changePassword(ChangePasswordRequest request) {
        UserAccess users = userAccessProvider.getIfAvailable();
        if (users == null || request == null) {
            throw new AuthApiException("Unable to change password right now.", "AUTH_CHANGE_PASSWORD_FAILED");
        }
        String emailRaw = request.getEmailId() == null ? "" : request.getEmailId().trim();
        String oldPassword = request.getOldPassword() == null ? "" : request.getOldPassword();
        String newPassword = request.getNewPassword() == null ? "" : request.getNewPassword().trim();
        if (emailRaw.isEmpty() || oldPassword.isBlank() || newPassword.isEmpty()) {
            throw new AuthApiException("Email, current password, and new password are required.", "AUTH_VALIDATION_FAILED");
        }
        if (oldPassword.equals(newPassword)) {
            throw new AuthApiException(
                    "New password must be different from your current password.",
                    "AUTH_PASSWORD_UNCHANGED");
        }

        passwordPolicy.validateOrThrow(newPassword);

        Optional<UserEntity> userOpt =
                emailRaw.contains("@")
                        ? users.findByEmail(emailRaw.toLowerCase())
                        : users.findByUsername(emailRaw);
        if (userOpt.isEmpty()) {
            throw new AuthApiException("No account found for this email address.", "AUTH_USER_NOT_FOUND");
        }
        UserEntity account = userOpt.get();
        RoleRequestStatus roleStatus = account.getRoleStatus() == null ? RoleRequestStatus.ACTIVE : account.getRoleStatus();

        if (!account.isActive() || RoleRequestStatus.INACTIVE.equals(roleStatus)) {
            throw new AuthApiException(
                    "Your account has been deactivated. You cannot sign in until an administrator reactivates your account.",
                    "AUTH_ACCOUNT_DEACTIVATED");
        }
        if (RoleRequestStatus.PENDING_APPROVAL.equals(roleStatus)) {
            throw new AuthApiException(
                    "Your request is pending for approval. Please wait for an admin to approve your request.",
                    "AUTH_ROLE_PENDING_APPROVAL");
        }
        if (!RoleRequestStatus.ACTIVE.equals(roleStatus)) {
            throw new AuthApiException(
                    "Your account cannot change password in its current state. Please contact support.",
                    "AUTH_ROLE_BLOCKED");
        }

        String hash = account.getPasswordHash();
        if (hash == null || hash.isBlank() || !passwordEncoder.matches(oldPassword, hash)) {
            throw new AuthApiException("Current password is incorrect.", "AUTH_INVALID_OLD_PASSWORD");
        }

        account.setPasswordHash(passwordEncoder.encode(newPassword));
        account.setUpdatedTimestamp(Instant.now());
        account.setTokenVersion(account.getTokenVersion() + 1L);
        users.save(account);
        log.info("Password changed userId={}", account.getId());
    }

    @Override
    public Optional<RefreshTokenResponse> refresh(RefreshTokenRequest request) {
        UserAccess users = userAccessProvider.getIfAvailable();
        RefreshTokenAccess refreshTokens = refreshTokenAccessProvider.getIfAvailable();
        if (users == null || refreshTokens == null || request == null) return Optional.empty();

        String suppliedRefreshToken = request.getRefreshToken() == null ? "" : request.getRefreshToken().trim();
        if (suppliedRefreshToken.isEmpty()) return Optional.empty();

        Optional<RefreshTokenEntity> tokenEntityOptional = refreshTokens.findByToken(suppliedRefreshToken);
        if (tokenEntityOptional.isEmpty()) {
            log.warn("Refresh token replay or invalid token attempt");
            return Optional.empty();
        }
        RefreshTokenEntity tokenEntity = tokenEntityOptional.get();
        if (tokenEntity.getExpiry() == null || tokenEntity.getExpiry().isBefore(Instant.now())) {
            refreshTokens.delete(tokenEntity);
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
            refreshTokens.delete(tokenEntity);
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

        Optional<UserEntity> userOptional = users.findById(tokenEntity.getUserId());
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
        refreshTokens.delete(tokenEntity);
        persistRefreshToken(refreshTokens, user.getId(), newRefreshToken, tokenEntity.getDeviceId());
        log.info("Refresh token rotated for userId={}", user.getId());

        return Optional.of(new RefreshTokenResponse(
                newAccessToken,
                jwtService.getAccessExpirationSeconds(),
                newRefreshToken,
                jwtService.getRefreshExpirationSeconds()));
    }

    @Override
    public boolean logout(LogoutRequest request) {
        RefreshTokenAccess refreshTokens = refreshTokenAccessProvider.getIfAvailable();
        if (refreshTokens == null || request == null) return false;

        String suppliedRefreshToken = request.getRefreshToken() == null ? "" : request.getRefreshToken().trim();
        if (suppliedRefreshToken.isEmpty()) return false;

        Optional<RefreshTokenEntity> tokenEntityOptional = refreshTokens.findByToken(suppliedRefreshToken);
        if (tokenEntityOptional.isEmpty()) return false;
        RefreshTokenEntity tokenEntity = tokenEntityOptional.get();

        String deviceId = request.getDeviceId() == null ? "" : request.getDeviceId().trim();
        if (!deviceId.isEmpty() && tokenEntity.getDeviceId() != null && !deviceId.equals(tokenEntity.getDeviceId())) {
            log.warn("Logout device mismatch userId={} expectedDevice={} actualDevice={}",
                    tokenEntity.getUserId(), tokenEntity.getDeviceId(), deviceId);
            return false;
        }

        refreshTokens.delete(tokenEntity);
        return true;
    }

    private void persistRefreshToken(
            RefreshTokenAccess refreshTokens,
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
        refreshTokens.save(tokenEntity);
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

