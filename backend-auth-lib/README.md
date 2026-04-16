# backend-auth-lib

Reusable Spring auth/login library for FlexShell backend projects.

## Provides

- `POST /api/auth/login` controller (`AuthController`)
- `POST /api/auth/refresh` controller (`AuthController`)
- `POST /api/auth/logout` controller (`AuthController`)
- Auth DTOs (`LoginRequest`, `LoginResponse`)
- Reusable facade contract (`AuthFacade`)
- Reusable JWT filter + authenticator interfaces (`JwtAuthenticationFilter`, `BearerTokenAuthenticator`)

## How to use in any backend

1. Add dependency:
   - `implementation 'com.flexshell:backend-auth-lib:0.0.1-SNAPSHOT'`
2. Include composite build for local development:
   - `includeBuild('../backend-auth-lib')`
3. Implement `AuthFacade` in your backend service:
   - Validate users from your store (MongoDB, SQL, etc.)
   - Generate JWT access + refresh tokens
   - Persist refresh token and implement rotation in `refresh`
   - Return `Optional<LoginResponse>`
4. Wire security:
   - Implement `BearerTokenAuthenticator` in your app
   - Register `JwtAuthenticationFilter` in your `SecurityFilterChain`

This keeps API/controller reusable while each backend controls identity validation and token strategy.

