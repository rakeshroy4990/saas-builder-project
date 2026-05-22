# Agastya Healthcare — Mobile (Expo)

React Native + Expo app for iOS and Android. Shares the Spring backend with [frontend-hospital](../frontend-hospital) (Vue web).

## Testing and deployment (Windows / Android / iOS)

See **[docs/TESTING.md](docs/TESTING.md)** for where to run the app, Play Store / TestFlight flows, and oshucare Cloud Run API URLs.

## Prerequisites

- Node 20+
- [Expo CLI](https://docs.expo.dev/) / EAS CLI for store builds
- Running `backend-hospital` (default `http://localhost:8080`) or Cloud Run staging URL

## Setup

```bash
cd mobile-hospital
cp .env.example .env
# Edit EXPO_PUBLIC_API_BASE_URL — use your LAN IP for physical devices
npm install
```

From monorepo root you can also run:

```bash
npm install
npm run start -w mobile-hospital
```

## Run

```bash
npm run start          # Expo dev server
npm run ios            # iOS simulator
npm run android        # Android emulator
npm test               # Jest unit tests
```

## Auth (mobile)

- Login: `POST /api/auth/login` with `{ EmailId, Password }`
- Responses include `accessToken` and `refreshToken` in JSON
- Access token: **memory only** (Zustand)
- Refresh token + profile: **expo-secure-store**
- API calls: `Authorization: Bearer <accessToken>`
- Refresh: `POST /api/auth/refresh` with `{ DeviceId: 'mobile', RefreshToken }`

Backend bearer support: `HospitalBearerTokenAuthenticator` in `backend-hospital`.

## Install APK on your Android phone

```bash
cd mobile-hospital
eas login
eas build --profile preview --platform android
```

Download the `.apk` from [expo.dev](https://expo.dev) → Builds. Steps: [docs/TESTING.md](docs/TESTING.md#install-an-apk-on-your-android-phone-sideload).

## EAS builds

```bash
npx eas-cli login
npx eas build --profile preview --platform all
npx eas build --profile production --platform all
```

Profiles are defined in [eas.json](./eas.json).

## Maestro smoke (optional)

```bash
maestro test .maestro/login-smoke.yaml
```

Requires a dev build and test credentials in the flow file.

## Phase 2 (planned)

- `react-native-agora` — video calls (`/api/hospital/video/session`)
- `react-native-ble-plx` — device readings (reuse parsers from `frontend-bluetooth-lib`)
- STOMP chat with Bearer WebSocket auth

See [hospital mobile plan](../.cursor/plans/hospital_mobile_app_55e03f1a.plan.md).
