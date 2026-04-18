# Package: `com.flexshell.auth` (+ `auth.api`, `auth.security`)

## Role

Hospital-specific **user model**, tokens, and JWT/cookie authentication pieces layered on **`backend-auth-lib`**.

## Contents

- `UserEntity`, `UserRepository`, `RefreshTokenEntity`, `RefreshTokenRepository` — Mongo users/sessions when Mongo is enabled
- `UserRole`, `RoleRequestStatus` — enums for RBAC / approval flows
- `JwtService` — local JWT helpers where not fully delegated to the lib
- `security/HospitalBearerTokenAuthenticator` — hospital wiring for bearer/cookie auth (`Hospital`-prefixed; integrates with `SecurityConfig`)
- `SecurityConfig` references `BearerTokenAuthenticator` + `JwtAuthenticationFilter` for stateless JWT

## Security (see root `context.md`)

- `/api/auth/**` — public (handled by auth lib controllers)
- Cookie name configurable: `app.auth.cookie.access-token-name`

## When Mongo is disabled

`FlexShellApplication` can disable Mongo auto-config; user repositories may be unavailable — flows should tolerate or gate setup.

---

*Last updated: 2026-04-18*
