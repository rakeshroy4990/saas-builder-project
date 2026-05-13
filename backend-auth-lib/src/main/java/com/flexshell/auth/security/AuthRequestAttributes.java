package com.flexshell.auth.security;

/**
 * Request-scoped values set after successful JWT validation so downstream code can reuse the same
 * access token (e.g. proxy to another service) without re-parsing cookies or headers.
 */
public final class AuthRequestAttributes {
    /** Raw JWT access token string (no {@code Bearer} prefix). */
    public static final String RAW_ACCESS_TOKEN = "com.flexshell.auth.RAW_ACCESS_TOKEN";

    private AuthRequestAttributes() {
    }
}
