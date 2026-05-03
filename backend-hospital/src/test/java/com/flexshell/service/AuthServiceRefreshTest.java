package com.flexshell.service;

import com.flexshell.auth.JwtService;
import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.auth.UserEntity;
import com.flexshell.persistence.api.RefreshTokenAccess;
import com.flexshell.persistence.api.UserAccess;
import com.flexshell.auth.UserRole;
import com.flexshell.auth.api.RefreshTokenRequest;
import com.flexshell.auth.api.RefreshTokenResponse;
import com.flexshell.email.AppEmailProperties;
import com.flexshell.security.PasswordPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceRefreshTest {

    private static final String SECRET = "unit-test-jwt-secret-minimum-32-characters-long";
    private static final String ISSUER = "test-issuer";

    private UserAccess users;
    private RefreshTokenAccess refreshTokenAccess;
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        users = mock(UserAccess.class);
        refreshTokenAccess = mock(RefreshTokenAccess.class);
        jwtService = new JwtService(SECRET, 900L, 3600L, ISSUER);

        @SuppressWarnings("unchecked")
        ObjectProvider<UserAccess> userProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<RefreshTokenAccess> refreshProvider = mock(ObjectProvider.class);
        when(userProvider.getIfAvailable()).thenReturn(users);
        when(refreshProvider.getIfAvailable()).thenReturn(refreshTokenAccess);
        when(refreshTokenAccess.save(any(RefreshTokenEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AppEmailProperties emailProperties = mock(AppEmailProperties.class);
        PasswordPolicy passwordPolicy = mock(PasswordPolicy.class);
        authService = new AuthService(userProvider, refreshProvider, jwtService, emailProperties, passwordPolicy);
    }

    @Test
    void refresh_emptyRefreshToken_returnsEmpty() {
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setDeviceId("browser");
        assertTrue(authService.refresh(request).isEmpty());
    }

    @Test
    void refresh_unknownToken_returnsEmpty() {
        when(refreshTokenAccess.findByToken("missing")).thenReturn(Optional.empty());
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken("missing");
        request.setDeviceId("browser");
        assertTrue(authService.refresh(request).isEmpty());
    }

    @Test
    void refresh_expiredEntity_returnsEmptyAndDeletes() {
        String rt = jwtService.generateRefreshToken("u1", "web", "browser", 1L);
        RefreshTokenEntity entity = new RefreshTokenEntity();
        entity.setToken(rt);
        entity.setUserId("u1");
        entity.setDeviceId("browser");
        entity.setExpiry(Instant.now().minusSeconds(60));
        when(refreshTokenAccess.findByToken(rt)).thenReturn(Optional.of(entity));

        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken(rt);
        request.setDeviceId("browser");

        assertTrue(authService.refresh(request).isEmpty());
        verify(refreshTokenAccess).delete(entity);
    }

    @Test
    void refresh_deviceMismatch_returnsEmpty() {
        String rt = jwtService.generateRefreshToken("u1", "web", "browser", 1L);
        RefreshTokenEntity entity = entityFor(rt, "u1", "browser", Instant.now().plusSeconds(3600));
        when(refreshTokenAccess.findByToken(rt)).thenReturn(Optional.of(entity));

        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken(rt);
        request.setDeviceId("mobile");

        assertTrue(authService.refresh(request).isEmpty());
        verify(refreshTokenAccess, never()).delete(entity);
    }

    @Test
    void refresh_tokenVersionMismatch_returnsEmpty() {
        String rt = jwtService.generateRefreshToken("u1", "web", "browser", 1L);
        RefreshTokenEntity entity = entityFor(rt, "u1", "browser", Instant.now().plusSeconds(3600));
        when(refreshTokenAccess.findByToken(rt)).thenReturn(Optional.of(entity));

        UserEntity user = activeUser("u1", 2L);

        when(users.findById("u1")).thenReturn(Optional.of(user));

        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken(rt);
        request.setDeviceId("browser");

        assertTrue(authService.refresh(request).isEmpty());
    }

    @Test
    void refresh_accessTokenUsedAsRefresh_returnsEmpty() {
        String access = jwtService.generateAccessToken("u1", "web", 1L, UserRole.PATIENT.name());
        RefreshTokenEntity entity = entityFor(access, "u1", "browser", Instant.now().plusSeconds(3600));
        when(refreshTokenAccess.findByToken(access)).thenReturn(Optional.of(entity));

        UserEntity user = activeUser("u1", 1L);
        when(users.findById("u1")).thenReturn(Optional.of(user));

        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken(access);
        request.setDeviceId("browser");

        assertTrue(authService.refresh(request).isEmpty());
    }

    @Test
    void refresh_validRotatesAndReturnsNewPair() {
        String rt = jwtService.generateRefreshToken("u1", "web", "browser", 1L);
        RefreshTokenEntity entity = entityFor(rt, "u1", "browser", Instant.now().plusSeconds(3600));
        when(refreshTokenAccess.findByToken(rt)).thenReturn(Optional.of(entity));

        UserEntity user = activeUser("u1", 1L);
        when(users.findById("u1")).thenReturn(Optional.of(user));

        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken(rt);
        request.setDeviceId("browser");

        Optional<RefreshTokenResponse> out = authService.refresh(request);
        assertTrue(out.isPresent());
        assertEquals(jwtService.getAccessExpirationSeconds(), out.get().getAccessTokenExpiresInSeconds());
        assertEquals(jwtService.getRefreshExpirationSeconds(), out.get().getRefreshTokenExpiresInSeconds());
        verify(refreshTokenAccess).delete(entity);
        verify(refreshTokenAccess).save(any(RefreshTokenEntity.class));
    }

    private static RefreshTokenEntity entityFor(String token, String userId, String deviceId, Instant expiry) {
        RefreshTokenEntity e = new RefreshTokenEntity();
        e.setToken(token);
        e.setUserId(userId);
        e.setDeviceId(deviceId);
        e.setExpiry(expiry);
        return e;
    }

    private static UserEntity activeUser(String id, long tokenVersion) {
        UserEntity u = new UserEntity();
        u.setId(id);
        u.setActive(true);
        u.setTokenVersion(tokenVersion);
        u.setRole(UserRole.PATIENT);
        return u;
    }
}
