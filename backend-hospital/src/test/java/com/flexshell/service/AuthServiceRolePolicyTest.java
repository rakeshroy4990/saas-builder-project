package com.flexshell.service;

import com.flexshell.auth.JwtService;
import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.auth.RefreshTokenRepository;
import com.flexshell.auth.RoleRequestStatus;
import com.flexshell.auth.UserEntity;
import com.flexshell.auth.UserRepository;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.api.AuthApiException;
import com.flexshell.auth.api.RegisterRequest;
import com.flexshell.auth.api.RegisterResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceRolePolicyTest {
    private UserRepository userRepository;
    private RefreshTokenRepository refreshTokenRepository;
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        refreshTokenRepository = mock(RefreshTokenRepository.class);
        jwtService = mock(JwtService.class);

        @SuppressWarnings("unchecked")
        ObjectProvider<UserRepository> userProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<RefreshTokenRepository> refreshProvider = mock(ObjectProvider.class);

        when(userProvider.getIfAvailable()).thenReturn(userRepository);
        when(refreshProvider.getIfAvailable()).thenReturn(refreshTokenRepository);
        when(jwtService.getRefreshExpirationSeconds()).thenReturn(3600L);
        when(refreshTokenRepository.save(any(RefreshTokenEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService = new AuthService(userProvider, refreshProvider, jwtService);
    }

    @Test
    void registerWithoutRoleDefaultsToPatientActive() {
        RegisterRequest request = buildRequest(null);
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
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
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
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
    void loginWithPendingApprovalIsBlocked() {
        UserEntity pendingUser = new UserEntity();
        pendingUser.setId("user-3");
        pendingUser.setEmail("alice@example.com");
        pendingUser.setActive(true);
        pendingUser.setRoleStatus(RoleRequestStatus.PENDING_APPROVAL);
        pendingUser.setPasswordHash(new BCryptPasswordEncoder().encode("StrongPass123"));

        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(pendingUser));

        AuthApiException exception = assertThrows(
                AuthApiException.class,
                () -> authService.login("alice@example.com", "StrongPass123"));
        assertEquals("AUTH_ROLE_PENDING_APPROVAL", exception.getErrorCode());
        verify(refreshTokenRepository, never()).save(any(RefreshTokenEntity.class));
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
