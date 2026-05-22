# Testing and deployment — Agastya Healthcare mobile

This guide covers **where** to run, test, and ship the Expo app (`mobile-hospital`) on **Windows**, **Android**, and **iOS**, and how that relates to the **oshucare** GCP project and existing web hosting.

## What goes where (quick map)

| Product | Technology | Deploy / host | Test on |
|---------|------------|---------------|---------|
| **Mobile app (this repo)** | Expo / React Native | **Google Play** + **Apple App Store** (via **EAS Build**) | Phones, emulators, TestFlight, Play internal |
| **Web app** | Vue (`frontend-hospital`) | **Firebase Hosting** and/or **Render** | Any browser (Windows, Mac, phone browser) |
| **API** | Spring (`backend-hospital`) | **GCP Cloud Run** (`oshucare` project) | Same URL the app calls |

The mobile app does **not** deploy to Firebase or Cloud Run. It only **calls** the API.

### oshucare / production API (reference)

Set in `mobile-hospital/.env` for staging or production testing:

```env
EXPO_PUBLIC_API_BASE_URL=https://backend-hospital-yspwmymsgq-el.a.run.app
```

Use **HTTPS** for real devices and store builds. For local backend:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
```

Web UI (unchanged): Firebase / Render — e.g. `https://agastyahealthcare.com`, `https://oshu-ai-clinic-ui.onrender.com`.

---

## Windows (your dev PC)

Windows is ideal for **coding**, **Android emulator**, and **uploading EAS builds**. It is **not** a mobile store target for this project.

| Task | Tool | Notes |
|------|------|--------|
| Edit & run dev server | `npm run start` in `mobile-hospital` | Expo Dev Tools / QR code |
| Android UI without a phone | **Android Studio** → AVD → `npm run android` | Install [Android Studio](https://developer.android.com/studio) + one API 33+ emulator |
| Phone on same Wi‑Fi | **Expo Go** | In `.env`, use PC LAN IP, not `localhost` (see below) |
| Unit tests | `npm test` | API envelope / auth parsing |
| EAS cloud builds | `eas-cli` from Windows | Builds iOS **in the cloud** (no Mac required for compile) |
| iOS Simulator | **Not on Windows** | Use a Mac, or TestFlight on a physical iPhone |

### LAN IP for physical devices (Windows)

```powershell
ipconfig
# Use IPv4 Address of Wi‑Fi adapter, e.g. 192.168.1.42
```

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:8080
```

Ensure `backend-hospital` listens on `0.0.0.0:8080` (or port-forward) and Windows firewall allows inbound from the phone.

---

## Install an APK on your Android phone (sideload)

Use this when you want a **real installable app** (not Expo Go). **No Android SDK on your Mac is required** if you use **EAS Build** in the cloud.

### 1. Set the API URL for the build

EAS bakes `EXPO_PUBLIC_*` at build time. In [eas.json](../eas.json) you can add env per profile, or set secrets:

```bash
cd mobile-hospital
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value "https://backend-hospital-yspwmymsgq-el.a.run.app" --type string
```

Or add to `eas.json` under `preview.env` (committed — only non-secret URLs):

```json
"env": {
  "EXPO_PUBLIC_API_BASE_URL": "https://backend-hospital-yspwmymsgq-el.a.run.app"
}
```

For a **local backend** on your Wi‑Fi, use your Mac’s LAN IP (the phone must reach that IP when testing).

### 2. Build an APK (EAS)

The **preview** profile is configured with `"buildType": "apk"` so you get a downloadable `.apk`, not only an AAB.

```bash
npm install -g eas-cli   # once
cd mobile-hospital
eas login
eas build:configure      # first time only — links Expo project
eas build --profile preview --platform android
```

Wait for the build on [expo.dev](https://expo.dev) → your project → **Builds**. When it finishes, open the build and tap **Download** (APK).

### 3. Install on the phone

1. Copy the APK to the phone (USB, Google Drive, email, or scan/download link in Chrome on the device).
2. **Settings → Security** (or **Install unknown apps**) → allow your **Files** / **Chrome** app to install unknown apps.
3. Open the APK file → **Install**.
4. Launch **Agastya Healthcare** (`com.agastya.healthcare`).

### 4. Local APK build (optional — needs Android SDK)

Only if you already installed Android Studio and `ANDROID_HOME`:

```bash
cd mobile-hospital
npx expo prebuild --platform android   # generates android/ once
cd android && ./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Sign the release APK for repeat installs, or use a debug build:

```bash
./gradlew assembleDebug
# android/app/build/outputs/apk/debug/app-debug.apk
```

Prefer **EAS `preview` APK** unless you need fully offline builds.

---

## Android

### Local / QA testing

1. **Expo Go** (fastest)  
   - `npm run start` → scan QR with Expo Go app.  
   - Good for: login, appointments list, profile.  
   - Limitation: Phase 2 **Agora / BLE** need a **development build**, not Expo Go.

2. **Android Emulator** (on Windows or Mac)  
   - Android Studio → Virtual Device → Run.  
   - `cd mobile-hospital && npm run android`

3. **Physical device (USB or Wi‑Fi)**  
   - Required for reliable **camera**, **BLE**, and **video** later.  
   - Enable developer mode + USB debugging, or use internal APK from EAS.

### Store / internal distribution (deploy target)

| Stage | Where | Command / action |
|-------|--------|------------------|
| Internal QA | **Google Play Console** → Testing → **Internal testing** | `eas build --profile preview --platform android` → upload AAB or let EAS submit |
| Production | **Google Play** → Production | `eas build --profile production --platform android` |

- **Package name:** `com.agastya.healthcare` ([`app.json`](../app.json))  
- **GCP project for backend:** `oshucare` (API on Cloud Run, not Play)

```bash
cd mobile-hospital
npx eas-cli login
eas build --profile preview --platform android
# Install APK from EAS page, or connect Play Console for internal track
```

---

## iOS

### Local testing

| Option | Requires | Command |
|--------|----------|---------|
| **iOS Simulator** | **macOS** + Xcode | `npm run ios` |
| **Expo Go on iPhone** | iPhone + same network as dev machine | `npm run start` → Camera → QR |
| **TestFlight** | Apple Developer Program ($) | EAS build → App Store Connect |

You **cannot** run the iOS Simulator on Windows. From Windows, use **EAS Build** + **TestFlight** for real iOS testing.

### Store / internal distribution (deploy target)

| Stage | Where | Command |
|-------|--------|---------|
| Internal QA | **App Store Connect** → **TestFlight** → Internal testers | `eas build --profile preview --platform ios` |
| Production | **App Store** review | `eas build --profile production --platform ios` → Submit |

- **Bundle ID:** `com.agastya.healthcare`  
- First-time: create app in App Store Connect, configure signing in EAS (`eas credentials`).

```bash
eas build --profile preview --platform ios
# After build: App Store Connect → TestFlight → add testers
```

---

## EAS Build profiles ([`eas.json`](../eas.json))

| Profile | Use |
|---------|-----|
| `development` | Dev client, simulator builds, debugging native modules |
| `preview` | Internal APK/IPA — QA, TestFlight internal, Play internal |
| `production` | Store submission, auto-increment version |

Build both platforms from any OS:

```bash
eas build --profile preview --platform all
```

Link the project to Expo (one time):

```bash
eas init
# Choose or create Expo account; project slug: agastya-healthcare
```

---

## Environment matrix

| Environment | `EXPO_PUBLIC_API_BASE_URL` | Who uses it |
|-------------|----------------------------|-------------|
| Local backend | `http://localhost:8080` or `http://<LAN-IP>:8080` | Emulator on same machine / phone on Wi‑Fi |
| oshucare staging/prod API | `https://backend-hospital-yspwmymsgq-el.a.run.app` | Preview & production mobile builds, real devices |
| Web only | N/A (use `VITE_SPRING_API_BASE_URL` in `frontend-hospital`) | Browsers |

Rebuild or restart Expo after changing `.env` (env is read at bundle time for `EXPO_PUBLIC_*`).

---

## Automated checks

| Layer | Command | What it covers |
|-------|---------|----------------|
| Unit | `npm test` | Shared `@saas-builder/hospital-api-client` parsing |
| E2E smoke (optional) | `maestro test .maestro/login-smoke.yaml` | App opens to Sign in (needs dev/ preview build on device) |

Install [Maestro](https://maestro.mobile.dev/) and run against an APK/IPA from EAS `preview`, not Expo Go, once flows include native modules.

---

## Manual release checklist

Run before promoting **preview → production**:

1. [ ] Login / logout on **Android** (physical device) against Cloud Run API  
2. [ ] Login / logout on **iOS** (TestFlight) against Cloud Run API  
3. [ ] Session survives app kill + reopen (refresh token in Secure Store)  
4. [ ] Appointments list loads (patient and doctor accounts)  
5. [ ] Appointment detail opens  
6. [ ] Profile loads; sign out returns to login  
7. [ ] API URL is **HTTPS** in production `.env` / EAS secrets  
8. [ ] No tokens or PHI in logs  

Phase 2 (when implemented): video call, BLE reading, chat — test on **real hardware** per platform.

---

## Play Console & App Store Connect (one-time setup)

### Google Play (Android)

1. [Google Play Console](https://play.google.com/console) → Create app **Agastya Healthcare**  
2. Package: `com.agastya.healthcare`  
3. Testing → Internal testing → Create release → upload AAB from EAS  
4. Add tester emails → share opt-in link  

### Apple (iOS)

1. [Apple Developer](https://developer.apple.com/) → Identifiers → App ID `com.agastya.healthcare`  
2. [App Store Connect](https://appstoreconnect.apple.com/) → New app  
3. TestFlight → Internal testing → invite testers  
4. Let EAS manage certificates (`eas credentials`) or upload your own  

---

## Troubleshooting

### EAS build: `Unable to resolve module react-native-worklets`

`react-native-reanimated` 4.x requires **`react-native-worklets`** as a direct dependency. Install with Expo (do not pin by hand):

```bash
cd mobile-hospital
npx expo install react-native-worklets react-native-reanimated
```

Commit `package.json` and `package-lock.json`, then run `eas build` again. Ensure [`babel.config.js`](../babel.config.js) lists `react-native-reanimated/plugin` last.

### `Failed to resolve the Android SDK path` / `spawn adb ENOENT`

Expo pressed **Open on Android** (`a`) but **Android Studio / SDK is not installed** (or `ANDROID_HOME` is unset).

**Option A — No SDK (fastest): use a physical phone**

1. Install **[Expo Go](https://expo.dev/go)** on your Android phone.
2. Run `npm run start` (do **not** press `a`).
3. Scan the QR code (same Wi‑Fi as your Mac).
4. In `.env`, set `EXPO_PUBLIC_API_BASE_URL` to your Mac’s LAN IP if using a local backend (not `localhost`).

**Option B — Install SDK for emulator / `npm run android`**

1. Install [Android Studio](https://developer.android.com/studio) (or `brew install --cask android-studio`).
2. Open Android Studio → **Settings** → **Languages & Frameworks** → **Android SDK** → install **Android SDK Platform** (API 34+) and **Android SDK Platform-Tools**.
3. Add to `~/.zshrc` (then `source ~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

4. Create a virtual device: **Device Manager** → **Create device** → run emulator.
5. Verify: `adb devices` then `npm run android` or press `a` in Expo.

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Network error on phone | `localhost` in `.env` | Use LAN IP or Cloud Run HTTPS URL |
| 401 on every request | Wrong API URL or expired refresh | Log out; check Bearer flow in [MOBILE_AUTH.md](./MOBILE_AUTH.md) |
| CORS errors | N/A on native | CORS is browser-only; if you see this, you may be on `expo web` |
| iOS build fails on Windows | Expected | Use `eas build --platform ios` (cloud) |
| Expo Go missing feature | Native module | `eas build --profile development` + dev client |

---

## Related docs

- [README.md](../README.md) — setup and scripts  
- [MOBILE_AUTH.md](./MOBILE_AUTH.md) — Bearer vs web cookies  
- [cloudbuild.yaml](../../cloudbuild.yaml) — deploy `backend-hospital` to `oshucare`  
- [frontend-hospital Untitled / .env.example](../../frontend-hospital/.env.example) — web API URL parity  
