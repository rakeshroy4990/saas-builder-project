# Production Security Checklist

Last verified against current code in:
- `backend-hospital`
- `frontend-hospital`

Use this checklist before promoting to production.

Status legend:
- `[x]` implemented in current codebase
- `[ ]` still required before production

## 1) Secrets and env files

- [ ] Ensure `.env`, `.env.*`, private keys, and credentials are gitignored.
- [ ] Never commit real secrets in source, docs, scripts, or CI logs.
- [ ] Keep only placeholders in sample files.
- [ ] Load secrets from a secret manager, not from hardcoded files.
- [ ] Rotate secrets on a schedule and after any suspected leak.

## 2) Required backend env vars

For `backend-hospital`, verify these values exist in production:

- [ ] `APP_AUTH_JWT_SECRET` is set and strong.
- [ ] `APP_AUTH_JWT_ISSUER` is set to your production issuer.
- [ ] `APP_AUTH_JWT_ACCESS_EXPIRATION_SECONDS` is set (recommended `600` to `900`).
- [ ] `APP_AUTH_JWT_REFRESH_EXPIRATION_SECONDS` is set (risk-policy based).
- [ ] `APP_CORS_ALLOWED_ORIGINS` includes only trusted domains.
- [ ] `SPRING_DATA_MONGODB_URI` (or secure equivalent) is set.

## 3) JWT runtime safeguards (`JwtService`)

- [ ] Production must not rely on fallback defaults for JWT secret/issuer.
- [ ] Application startup should fail if secret is default/weak.
- [ ] Issuer validation must match your public API identity.
- [x] Access tokens are short-lived (`900` seconds default).
- [x] Refresh token lifetime is configurable (`2592000` seconds default).
- [ ] Align issuer fallback defaults to a single value across:
  - `app.auth.jwt.issuer` in `application.properties` (`flexshell-hospital`)
  - `@Value` fallback in `JwtService` (`flexshell-backend`)

## 4) Request authentication enforcement

- [x] `/api/auth/**` is public.
- [x] All other routes require authentication (`SecurityConfig` + JWT filter).
- [x] Missing/invalid/expired tokens return `401` from JWT filter.
- [x] Refresh tokens are rejected for protected routes (`tokenType=refresh` blocked).

## 5) Refresh token controls

- [x] Refresh token is persisted server-side (`refresh_tokens` collection).
- [x] Refresh token rotation is enabled on refresh.
- [x] Old refresh token is invalid after rotation.
- [x] Refresh token replay/invalid attempts are denied and logged.
- [x] Device binding checks are enforced when `DeviceId` is provided.
- [x] Logout invalidates refresh token server-side.
- [ ] Store hashed refresh tokens in DB (currently raw token is stored).

## 6) Token revocation and session invalidation

- [x] `tokenVersion` exists for users and is validated.
- [ ] Password reset / admin revoke increments `tokenVersion`.
- [ ] Old access/refresh tokens fail after version change.

## 7) Frontend token handling (`frontend-hospital`)

- [x] Auth tokens are not stored in `localStorage` (in-memory store used).
- [x] Tokens are currently kept in memory.
- [x] `401` interceptor attempts refresh once, then logs out on failure.
- [x] Logout clears local token state and calls backend logout.
- [ ] If you need persistence across page reloads, move to HttpOnly cookie model.

## 8) Transport and network security

- [ ] HTTPS is enforced at edge and origin.
- [ ] HSTS is enabled for production domains.
- [ ] HTTP to HTTPS redirects are active.
- [x] CORS is origin-restricted by config (`APP_CORS_ALLOWED_ORIGINS`).
- [ ] Ensure prod `APP_CORS_ALLOWED_ORIGINS` has only real domains (no localhost).

## 9) Logging and monitoring

- [x] Auth flow logs invalid token usage, refresh replay indicators, and device mismatch.
- [ ] Never log raw JWT, passwords, or secrets.
- [ ] Alert on spikes in `401`, refresh failures, or replay patterns.

## 10) Abuse protection

- [ ] Add rate limits on `/api/auth/login`, `/api/auth/refresh`, `/api/auth/register`.
- [ ] Add brute-force protections (IP/user throttling and lockout strategy).
- [ ] Add suspicious activity detection for repeated invalid tokens.

## 11) Database and data protection

- [ ] MongoDB access is private/network restricted.
- [ ] Database credentials are least-privilege.
- [ ] Data at rest encryption is enabled.
- [ ] Backup and restore process is tested.
- [ ] Token record retention/cleanup policy is defined.

## 12) CI/CD gates

- [ ] Pipeline blocks release if required env vars are missing.
- [ ] Security scans (SAST + secret scans) run on every release branch.
- [ ] Automated checks cover:
  - [ ] unauthorized access returns `401`
  - [ ] token tamper rejection
  - [ ] refresh replay rejection
  - [ ] refresh after logout rejection
  - [ ] tokenVersion mismatch rejection

## 13) Final go-live signoff

- [ ] Security checklist reviewed and approved.
- [ ] Incident response contacts documented.
- [ ] Rollback plan validated.
- [ ] Post-deploy monitoring dashboard confirmed.

## 14) Current code observations to address

- [ ] `SecurityConfig` is conditional on `BearerTokenAuthenticator`.
      Ensure this bean is always present in production profiles so auth cannot be accidentally disabled.
- [ ] `WebCorsConfig` uses `allowCredentials(false)`.
      Keep this if using bearer tokens in headers; if moving to cookie auth later, revisit.
- [ ] Add startup validation for JWT config:
  - reject default secret value
  - reject blank/weak issuer
  - reject non-positive expiry values

