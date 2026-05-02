package com.flexshell.security;

import com.flexshell.auth.api.AuthApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Enforces password strength for registration and password changes.
 */
@Component
public class PasswordPolicy {

    private final int minLength;
    private final boolean requireMixed;

    public PasswordPolicy(
            @Value("${app.auth.password.min-length:12}") int minLength,
            @Value("${app.auth.password.require-mixed-character-classes:true}") boolean requireMixed) {
        this.minLength = Math.max(8, minLength);
        this.requireMixed = requireMixed;
    }

    /**
     * @throws AuthApiException with {@code AUTH_PASSWORD_POLICY} when validation fails
     */
    public void validateOrThrow(String rawPassword) {
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new AuthApiException("Password is required.", "AUTH_PASSWORD_POLICY");
        }
        if (rawPassword.length() < minLength) {
            throw new AuthApiException(
                    "Password must be at least " + minLength + " characters long.",
                    "AUTH_PASSWORD_POLICY");
        }
        if (!requireMixed) {
            return;
        }
        boolean upper = rawPassword.chars().anyMatch(Character::isUpperCase);
        boolean lower = rawPassword.chars().anyMatch(Character::isLowerCase);
        boolean digit = rawPassword.chars().anyMatch(Character::isDigit);
        boolean special = rawPassword.chars().anyMatch(ch -> !Character.isLetterOrDigit(ch));
        if (!(upper && lower && digit && special)) {
            throw new AuthApiException(
                    "Password must include uppercase, lowercase, a number, and a special character.",
                    "AUTH_PASSWORD_POLICY");
        }
    }
}
