package com.flexshell.auth.api;

import java.util.Optional;

/**
 * Reusable contract for login/auth APIs.
 * Any backend project can implement this facade with its own persistence and token strategy.
 */
public interface AuthFacade {
    Optional<LoginResponse> login(String emailId, String password);

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

