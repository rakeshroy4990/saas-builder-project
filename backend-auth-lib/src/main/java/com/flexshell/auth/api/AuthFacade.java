package com.flexshell.auth.api;

import java.util.Optional;

/**
 * Reusable contract for login/auth APIs.
 * Any backend project can implement this facade with its own persistence and token strategy.
 */
public interface AuthFacade {
    Optional<LoginResponse> login(String emailId, String password);

    /**
     * Completes login using a Google OAuth access token (browser token client). Implementations
     * should validate the token with Google, resolve a verified email, and issue the same tokens
     * as password login when a matching account exists.
     */
    default Optional<LoginResponse> loginWithGoogleAccessToken(String accessToken) {
        return Optional.empty();
    }

    Optional<RegisterResponse> register(RegisterRequest request);

    /**
     * Verifies the current password and sets a new password hash. Implementations may throw
     * {@link AuthApiException} with stable {@code errorCode} values for API responses.
     */
    void changePassword(ChangePasswordRequest request);

    default Optional<RefreshTokenResponse> refresh(RefreshTokenRequest request) {
        return Optional.empty();
    }

    default boolean logout(LogoutRequest request) {
        return false;
    }
}

