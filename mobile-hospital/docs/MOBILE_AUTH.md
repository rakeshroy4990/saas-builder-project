# Mobile authentication

The Vue web app uses **httpOnly cookies**. The Expo app uses **Bearer tokens** in the `Authorization` header.

## Flow

1. `POST /api/auth/login` with `{ EmailId, Password }`
2. Read `accessToken` and `refreshToken` from the JSON envelope `data` field
3. Store refresh token and a minimal user profile in `expo-secure-store`
4. Keep access token in memory (Zustand) only
5. On each API request, set `Authorization: Bearer <accessToken>`
6. On `401`, call `POST /api/auth/refresh` with `{ DeviceId: 'mobile', RefreshToken }`, then retry once

## Google Sign-In (Android APK)

### Native sign-in (`@react-native-google-signin/google-signin`)

The app uses **native** Google Sign-In (not browser OAuth). `DEVELOPER_ERROR` almost always means the **SHA-1 fingerprint** on your [Google Cloud Console](https://console.cloud.google.com/apis/credentials) **Android OAuth client** does not match the key that signed the installed APK.

| Field | Required value |
|--------|----------------|
| Type | **Android** (not Web) |
| Package name | `com.agastya.healthcare` (exact match with `app.json`) |
| SHA-1 | From **EAS signing key** for the profile you built (`preview`, `development`, etc.) |

`GoogleSignin.configure({ webClientId })` must use the **Web application** client ID (`…k1e8jsn96…`), not the Android client ID.

Get SHA-1:

```bash
cd mobile-hospital
eas credentials -p android
```

Open **Keystore** → copy **SHA-1** → add to the Android OAuth client → wait 5–10 minutes. **No rebuild** is required for SHA-1-only changes.

**Firebase is not required.** Native Google Sign-In works with [Google Cloud Console](https://console.cloud.google.com/apis/credentials) OAuth clients only.

If you add `google-services.json` (optional Firebase path), it must:

- Use the **same GCP project** as `googleOAuthClientId` / `googleAndroidClientId` in `app.json` (project number prefix must match, e.g. `148957600999-…`).
- Include a non-empty **`oauth_client`** array (enable **Google** under Firebase → Authentication → Sign-in method, add SHA-1 on the Android app, then re-download the file).
- Keep **`package_name`**: `com.agastya.healthcare`.

`app.config.js` runs `scripts/validateGoogleServices.js` at build time. If the file is invalid, the build falls back to the Google Cloud Console path and prints warnings.

### Do I need to regenerate client IDs?

**Usually no.** If you only fixed the **package name** or **SHA-1** on the same Android OAuth client in Google Cloud Console, keep the same client ID:

`148957600999-61r14rmr6ncldnnnep4aek6u7froej39.apps.googleusercontent.com`

Update `eas.json` / `app.json` **only if** Google gave you a **new** Android client ID (after deleting and recreating the client).

### Why does the error say "oshucare"?

That is the **OAuth consent screen / GCP project name**, not your Android package. Your package is `com.agastya.healthcare`. A message like "oshucare sent an invalid request" still means OAuth config (SHA-1, redirect URI, or test users) — not that the wrong app name is installed.

### Checklist (in order)

#### 1. Android OAuth client (screenshot settings)

| Field | Required value |
|--------|----------------|
| Type | **Android** (not Web) |
| Package name | `com.agastya.healthcare` (exact match with `app.json`) |
| SHA-1 | From **EAS signing key**, not only your laptop debug keystore |

Get the correct SHA-1:

```bash
cd mobile-hospital
eas credentials -p android
```

Open **Keystore** → copy **SHA-1 fingerprint(s)**. Add **every** SHA-1 listed to the Android OAuth client. If you use Google Play App Signing, also add the **App signing key certificate** SHA-1 from Play Console → Setup → App signing.

Wait 5–10 minutes after saving in Google Cloud Console.

#### 2. Web OAuth client — Authorized redirect URIs

Open the **Web** client (`…k1e8jsn96vg893pifqchvqf241eot688…`) → **Authorized redirect URIs** → add:

- `com.agastya.healthcare:/oauthredirect`

Optional (if Google still complains):

- `com.googleusercontent.apps.148957600999-61r14rmr6ncldnnnep4aek6u7froej39:/oauthredirect`
- `mobilehospital://oauthredirect`

#### 3. OAuth consent screen

- **Publishing status:** If **Testing**, add your Google account under **Test users**.
- **Authorized domains:** Include domains used by your backend if required.

#### 4. Client IDs in the app (must match Console)

In `eas.json` (all profiles that build APKs):

```json
"EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID": "148957600999-k1e8jsn96vg893pifqchvqf241eot688.apps.googleusercontent.com",
"EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "148957600999-61r14rmr6ncldnnnep4aek6u7froej39.apps.googleusercontent.com"
```

`EXPO_PUBLIC_*` values are **baked in at build time**. After any change:

```bash
eas build --profile preview --platform android
```

Uninstall the old APK before installing the new one.

#### 5. Verify on device

After a failed sign-in, the login screen shows:

- App package
- Redirect URI to register on the Web client
- Reminder to match EAS SHA-1

### Common mistakes

| Mistake | Result |
|---------|--------|
| Debug SHA-1 only, but APK signed by EAS | Invalid request |
| Wrong package on Android client | Invalid request |
| Redirect URI missing on **Web** client | redirect_uri_mismatch |
| Testing mode without your email as test user | Access blocked |
| Old APK after changing env / package | Still fails until rebuild |

## Backend

`HospitalBearerTokenAuthenticator` validates Bearer JWTs the same way as cookie-based sessions.

## Security

### JWT storage (never AsyncStorage)

| Token | Storage |
|-------|---------|
| Access JWT | **Memory only** (Zustand `sessionStore`) |
| Refresh JWT | **`expo-secure-store`** (`src/auth/secureTokens.ts`), `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| Profile snapshot | Same Secure Store (non-secret display fields) |

**Do not** use `@react-native-async-storage/async-storage` for tokens — it is unencrypted on Android.

### Silent refresh (401 + proactive)

- **Axios** (`src/api/client.ts`): refreshes before expiry on each request; on **401**, calls `POST /api/auth/refresh` once and retries.
- **Fetch** (AI chat NDJSON, multipart): `fetchWithAuthRetry` / `ensureFreshAccessToken`.
- **STOMP** (video signaling): `beforeConnect` refreshes the JWT so reconnects during calls stay authorized.
- **Foreground keeper** (`SessionTokenKeeper`): while the app is active, refreshes when the access token is within 5 minutes of expiry (reduces mid–video-call logouts).

### Certificate pinning (optional, production)

For Cloud Run / custom API hosts, set SPKI hashes at **build time** (requires EAS native build, not Expo Go):

```bash
# Example — replace hashes after extracting from your API host (see react-native-ssl-public-key-pinning docs)
EXPO_PUBLIC_SSL_PIN_JSON={"backend-hospital-yspwmymsgq-el.a.run.app":["<primary-spki-sha256>","<backup-spki-sha256>"]}
```

Initialization: `src/api/certificatePinning.ts` (no-op when env unset or in Expo Go).

### Biometric app lock (optional)

Profile → **App lock** uses `expo-local-authentication` when the app opens with a restored session (silent refresh) or returns from background. Preference is stored in Secure Store. Does not replace Google sign-in; adds biometric protection for already signed-in sessions.

### General

- Do not log tokens or patient identifiers
- Use `EXPO_PUBLIC_API_BASE_URL` with HTTPS in production
