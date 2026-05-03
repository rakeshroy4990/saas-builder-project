package com.flexshell.service;

import com.flexshell.auth.JwtService;
import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.RefreshTokenAccess;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.api.AuthApiException;
import com.flexshell.auth.api.ChangePasswordRequest;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import com.flexshell.email.AppEmailProperties;
import com.flexshell.security.PasswordPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceRolePolicyTest {
    private UserAccess users;
    private RefreshTokenAccess refreshTokenAccess;
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        users = mock(UserAccess.class);
        refreshTokenAccess = mock(RefreshTokenAccess.class);
        jwtService = mock(JwtService.class);

        @SuppressWarnings("unchecked")
        ObjectProvider<UserAccess> userProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<RefreshTokenAccess> refreshProvider = mock(ObjectProvider.class);

        when(userProvider.getIfAvailable()).thenReturn(users);
        when(refreshProvider.getIfAvailable()).thenReturn(refreshTokenAccess);
        when(jwtService.getRefreshExpirationSeconds()).thenReturn(3600L);
        when(refreshTokenAccess.save(any(RefreshTokenEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AppEmailProperties emailProperties = mock(AppEmailProperties.class);
        PasswordPolicy passwordPolicy = mock(PasswordPolicy.class);
        doNothing().when(passwordPolicy).validateOrThrow(anyString());

        authService = new AuthService(userProvider, refreshProvider, jwtService, emailProperties, passwordPolicy);
    }

    @Test
    void registerWithoutRoleDefaultsToPatientActive() {
        RegisterRequest request = buildRequest(null);
        when(users.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(users.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity user = invocation.getArgument(0);
            user.setId("user-1");
            return user;
        });

        Optional<RegisterResponse> response = authService.register(request);

        assertTrue(response.isPresent());
        assertEquals("PATIENT", response.get().getRole());
        assertEquals("ACTIVE", response.get().getRoleStatus());
    }

    @Test
    void registerDoctorCreatesPendingApprovalRequest() {
        RegisterRequest request = buildRequest("DOCTOR");
        when(users.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(users.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity user = invocation.getArgument(0);
            user.setId("user-2");
            return user;
        });

        Optional<RegisterResponse> response = authService.register(request);

        assertTrue(response.isPresent());
        assertEquals(UserRole.PATIENT.name(), response.get().getRole());
        assertEquals(RoleRequestStatus.PENDING_APPROVAL.name(), response.get().getRoleStatus());
        assertEquals(UserRole.DOCTOR.name(), response.get().getRequestedRole());
    }

    @Test
    void loginWithDeactivatedAccountThrowsExactMessage() {
        UserEntity inactiveUser = new UserEntity();
        inactiveUser.setId("user-inactive");
        inactiveUser.setEmail("bob@example.com");
        inactiveUser.setActive(false);
        inactiveUser.setRoleStatus(RoleRequestStatus.INACTIVE);
        inactiveUser.setPasswordHash(new BCryptPasswordEncoder().encode("StrongPass123"));

        when(users.findByEmail("bob@example.com")).thenReturn(Optional.of(inactiveUser));

        AuthApiException exception = assertThrows(
                AuthApiException.class,
                () -> authService.login("bob@example.com", "StrongPass123"));
        assertEquals("AUTH_ACCOUNT_DEACTIVATED", exception.getErrorCode());
        assertEquals(
                "Your account has been deactivated. You cannot sign in until an administrator reactivates your account.",
                exception.getMessage());
        verify(refreshTokenAccess, never()).save(any(RefreshTokenEntity.class));
    }

    @Test
    void registerWithExistingActiveEmailThrows() {
        RegisterRequest request = buildRequest(null);
        UserEntity existing = new UserEntity();
        existing.setEmail("alice@example.com");
        existing.setActive(true);
        existing.setRoleStatus(RoleRequestStatus.ACTIVE);
        when(users.findByEmail("alice@example.com")).thenReturn(Optional.of(existing));

        AuthApiException ex = assertThrows(AuthApiException.class, () -> authService.register(request));
        assertEquals("AUTH_ACCOUNT_EXISTS", ex.getErrorCode());
        assertEquals("An account already exists for this email address.", ex.getMessage());
        verify(users, never()).save(any(UserEntity.class));
    }

    @Test
    void registerWithExistingInactiveEmailThrows() {
        RegisterRequest request = buildRequest(null);
        UserEntity existing = new UserEntity();
        existing.setEmail("alice@example.com");
        existing.setActive(false);
        existing.setRoleStatus(RoleRequestStatus.INACTIVE);
        when(users.findByEmail("alice@example.com")).thenReturn(Optional.of(existing));

        AuthApiException ex = assertThrows(AuthApiException.class, () -> authService.register(request));
        assertEquals("AUTH_ACCOUNT_INACTIVE", ex.getErrorCode());
        assertEquals(
                "Your account is already inactive. You cannot register again with this email address until an administrator reactivates your account.",
                ex.getMessage());
        verify(users, never()).save(any(UserEntity.class));
    }

    @Test
    void changePasswordSuccessUpdatesHashAndTokenVersion() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        UserEntity user = new UserEntity();
        user.setId("u-cp");
        user.setEmail("alice@example.com");
        user.setActive(true);
        user.setRoleStatus(RoleRequestStatus.ACTIVE);
        user.setPasswordHash(encoder.encode("OldPass123"));
        user.setTokenVersion(3L);

        when(users.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
        when(users.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setEmailId("alice@example.com");
        req.setOldPassword("OldPass123");
        req.setNewPassword("NewPass9999");

        authService.changePassword(req);

        assertTrue(encoder.matches("NewPass9999", user.getPasswordHash()));
        assertEquals(4L, user.getTokenVersion());
        verify(users).save(user);
    }

    @Test
    void changePasswordWrongOldPasswordThrows() {
        UserEntity user = new UserEntity();
        user.setId("u-w");
        user.setEmail("alice@example.com");
        user.setActive(true);
        user.setRoleStatus(RoleRequestStatus.ACTIVE);
        user.setPasswordHash(new BCryptPasswordEncoder().encode("RightOld123"));
        when(users.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setEmailId("alice@example.com");
        req.setOldPassword("WrongOld");
        req.setNewPassword("NewPass9999");

        AuthApiException ex = assertThrows(AuthApiException.class, () -> authService.changePassword(req));
        assertEquals("AUTH_INVALID_OLD_PASSWORD", ex.getErrorCode());
    }

    @Test
    void changePasswordUnknownEmailThrows() {
        when(users.findByEmail("missing@example.com")).thenReturn(Optional.empty());
        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setEmailId("missing@example.com");
        req.setOldPassword("x");
        req.setNewPassword("NewPass9999");
        AuthApiException ex = assertThrows(AuthApiException.class, () -> authService.changePassword(req));
        assertEquals("AUTH_USER_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void changePasswordInactiveUserThrows() {
        UserEntity user = new UserEntity();
        user.setId("u-in");
        user.setEmail("alice@example.com");
        user.setActive(false);
        user.setRoleStatus(RoleRequestStatus.INACTIVE);
        user.setPasswordHash(new BCryptPasswordEncoder().encode("OldPass123"));
        when(users.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setEmailId("alice@example.com");
        req.setOldPassword("OldPass123");
        req.setNewPassword("NewPass9999");

        AuthApiException ex = assertThrows(AuthApiException.class, () -> authService.changePassword(req));
        assertEquals("AUTH_ACCOUNT_DEACTIVATED", ex.getErrorCode());
    }

    @Test
    void loginWithPendingApprovalIsBlocked() {
        UserEntity pendingUser = new UserEntity();
        pendingUser.setId("user-3");
        pendingUser.setEmail("alice@example.com");
        pendingUser.setActive(true);
        pendingUser.setRoleStatus(RoleRequestStatus.PENDING_APPROVAL);
        pendingUser.setPasswordHash(new BCryptPasswordEncoder().encode("StrongPass123"));

        when(users.findByEmail("alice@example.com")).thenReturn(Optional.of(pendingUser));

        AuthApiException exception = assertThrows(
                AuthApiException.class,
                () -> authService.login("alice@example.com", "StrongPass123"));
        assertEquals("AUTH_ROLE_PENDING_APPROVAL", exception.getErrorCode());
        verify(refreshTokenAccess, never()).save(any(RefreshTokenEntity.class));
    }

    private RegisterRequest buildRequest(String role) {
        RegisterRequest request = new RegisterRequest();
        request.setFirstName("Alice");
        request.setLastName("Smith");
        request.setEmailId("alice@example.com");
        request.setPassword("StrongPass123");
        request.setAddress("Bangalore");
        request.setGender("female");
        request.setMobileNumber("9999999999");
        request.setRole(role);
        return request;
    }
}
