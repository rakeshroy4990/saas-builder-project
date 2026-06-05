# Mobile API integration

## Base URL (environment-specific)

Never hardcode production URLs in application source. Configure per environment:

| Source | Variable |
|--------|----------|
| Local `.env` | `EXPO_PUBLIC_API_URL` (preferred) or `EXPO_PUBLIC_API_BASE_URL` |
| EAS build profile | Same vars in `eas.json` → `env` |
| `app.config.js` | Copies env into `expo.extra.apiBaseUrl` at build time |

Resolution: `src/config/apiUrl.ts` → `getMobileApiBaseUrl()` in `src/api/config.ts`.

- **Development** without env: falls back to `http://localhost:8080` only when `__DEV__` is true.
- **Release builds** without env: throw at startup (misconfiguration).

## Timeouts

| Constant | Value | Use |
|----------|-------|-----|
| `DEFAULT_API_TIMEOUT_MS` | 15s | Axios `apiClient`, public GETs, JSON fetch |
| `UPLOAD_API_TIMEOUT_MS` | 180s | Multipart uploads, AI NDJSON stream |
| `TELEMETRY_BATCH_TIMEOUT_MS` | 30s | Background telemetry batch |
| `SESSION_RESTORE_TIMEOUT_MS` | 30s | Cold-start refresh (splash window) |

Cloud Run cold starts should fail fast with a friendly timeout message instead of hanging the UI.

## User-facing errors

`src/api/apiErrors.ts` — `toUserFacingApiError()` maps network, timeout, offline, and envelope errors to safe copy.

Axios responses are normalized in `apiClient` interceptors. Feature code should use `extractApiErrorMessage()` or `getLoginErrorMessage()` / `getBookingErrorMessage()` rather than surfacing `error.message` from raw transport failures.

## Offline banner

`@react-native-community/netinfo` drives `useNetworkStore`. When offline, `OfflineBanner` appears at the top of the app (see root `app/_layout.tsx`).
