# Mobile authentication

The Vue web app uses **httpOnly cookies**. The Expo app uses **Bearer tokens** in the `Authorization` header.

## Flow

1. `POST /api/auth/login` with `{ EmailId, Password }`
2. Read `accessToken` and `refreshToken` from the JSON envelope `data` field
3. Store refresh token and a minimal user profile in `expo-secure-store`
4. Keep access token in memory (Zustand) only
5. On each API request, set `Authorization: Bearer <accessToken>`
6. On `401`, call `POST /api/auth/refresh` with `{ DeviceId: 'mobile', RefreshToken }`, then retry once

## Backend

`HospitalBearerTokenAuthenticator` validates Bearer JWTs the same way as cookie-based sessions.

## Security

- Do not store access tokens in AsyncStorage or SecureStore
- Do not log tokens or patient identifiers
- Use `EXPO_PUBLIC_API_BASE_URL` with HTTPS in production
