# Deploy hospital frontend and backend on Render (manual)

Step-by-step setup **without** a Blueprint: one **Web Service** (Docker API) and one **Static Site** (Vite). Paths match this repo (`render/Dockerfile.backend-hospital`, `render.yaml`).

**References:** [Render Dashboard](https://dashboard.render.com/) · [Docker on Render](https://render.com/docs/docker) · [Static sites](https://render.com/docs/static-sites) · [Deploy for Free](https://render.com/docs/free) · [Static redirects/rewrites (SPAs)](https://render.com/docs/redirects-rewrites)

### If the browser shows `{"message":"You are not logged in. Please login.","code":"AUTH_UNAUTHORIZED"}`

That JSON is returned only by the **Spring API** (not the Vite static files). It means the URL in the address bar is hitting the **Web Service (Docker)**, or you have only one public service and it is the API.

- On Render you should have **two** resources: a **Static Site** (Vue app) and a **Web Service** (backend). They get **two different** `https://<name>.onrender.com` URLs.
- **Open the app in the browser using the Static Site’s URL** (Render → your static site → the public URL at the top). The API URL is only for `VITE_SPRING_API_BASE_URL` and should not be the tab you use to browse `/page/...`.
- In the static site, add a **rewrite** so client-side routes work on refresh: **Source** `/*` → **Destination** `/index.html` (Rewrite, not redirect). The repo’s `render.yaml` includes this under `hospital-frontend` `routes`.
- If the static URL and API URL are different subdomains (e.g. `oshu-ai-clinic-ui.onrender.com` → `oshu-ai-clinic.onrender.com`), `APP_CORS_ALLOWED_ORIGIN_PATTERNS` must list the **browser origin** of the app (the UI hostname), not the API’s. CORS is implemented on the **API** via a `CorsConfigurationSource` bean (see `WebCorsConfig`) so preflight `OPTIONS` to `/api/**` gets the right headers.

### If `/page/...` returns **404** (after login, refresh, or pasting a deep link)

Vue uses **client-side** routes. The deployed files are only `index.html` and `assets/...` — there is no real file at `/page/hospital/home`, so the CDN must **rewrite** that URL to your SPA entry.

1. [Render](https://dashboard.render.com/) → your **static site** (e.g. `oshu-ai-clinic-ui`) → **Settings** (or the section that lists **Redirect/Rewrite** rules) → add a **Rewrite** (not a redirect):
   - **Source:** `/*`
   - **Destination:** `/index.html`
2. **Save** and run **Clear build cache & deploy** (or a manual deploy) for the static site.
3. If the site was **created in the UI** and you never used the repo’s [Blueprint / `render.yaml`](https://render.com/docs/infrastructure-as-code), the `routes` block in the yaml is **not** applied. You **must** add the rule in the dashboard for that static site, or [connect the Blueprint](https://render.com/docs/infrastructure-as-code#setup) so the service picks up the same `routes` as in this repo.
4. After pulling latest `main`, a new Vite build also places **`404.html`** (a copy of `index.html` in `dist/`) to help on hosts that use a 404 fallback file; the official Render fix is still the rewrite. Details: [Static redirects/rewrites](https://render.com/docs/redirects-rewrites).
5. **Favicon & link preview (logo when sharing a URL):** set in `frontend-hospital/index.html` (`<link rel="icon">`, `og:image`, `twitter:card`, etc.) and add assets under `frontend-hospital/public/` (Vite copies them to `dist/`). The in-app header logo in `src/configs/hospital/pages.ts` is separate. The repo ships **`public/og-share.jpg`** (1200×630) for Open Graph. On Render, set **`VITE_PUBLIC_SITE_URL`** on the **static site** build to your UI origin with **no trailing slash** (e.g. `https://oshu-ai-clinic-ui.onrender.com`). The Vite build then sets **`og:url`**, **`link rel="canonical"`**, and points **`og:image` / `og:image:secure_url` / `twitter:image`** at `https://<that-host>/og-share.jpg` (same origin as the shared link — better for WhatsApp than a third-party image host alone). If you omit `VITE_PUBLIC_SITE_URL`, the build keeps the Cloudinary absolute URL in `index.html`. **WhatsApp caches previews aggressively:** after deploying, use [Meta Sharing Debugger](https://developers.facebook.com/tools/debug/) on your site URL and click **Scrape Again**, then try sharing again (or append `?v=2` to the URL once when pasting in WhatsApp). Redeploy the static site after changing images or meta.

6. **WebSocket / video (STOMP):** the UI uses `wss://<API-host>/ws` (from `VITE_SPRING_API_BASE_URL`). The HTTP upgrade cannot carry `Authorization`; the backend must **permit** `/ws` in Spring Security and authenticate on **STOMP CONNECT** (already implemented in `backend-realtime-lib`). `backend-hospital` `SecurityConfig` includes `/ws` in `permitAll` and in the JWT filter skip list. Keep `APP_CORS_ALLOWED_ORIGIN_PATTERNS` including your UI origin so the STOMP endpoint’s `setAllowedOriginPatterns` matches (see `RealtimeWebSocketConfig` in `backend-realtime-lib`). On Render **Free** web services, cold starts can still drop the first WebSocket attempt until the instance is warm.

7. **`static.json` in the build output does not drive routing on Render.** [Render’s docs](https://render.com/docs/redirects-rewrites) use **Dashboard** rewrites or **`render.yaml` `routes`**, not a `static.json` in `dist/`. This repo still includes `frontend-hospital/public/static.json` and `render.yaml` routes for consistency with other tools; for Render you must set the **Rewrite `/*` → `/index.html`** in the static site (or use the Blueprint that includes `hospital-frontend` `routes`). Vite automatically copies `public/static.json` → `dist/static.json` on `npm run build` (no `cp` step needed).

---

## 0. Prerequisite

1. Push this **entire monorepo** to **GitHub** or **GitLab**. Render must see the repo root so that:
   - `frontend-hospital` can resolve `file:../packages/vue-async-ui` and Vite can use `../frontend-realtime-lib`.
   - `backend-hospital` Gradle composite builds can resolve `../backend-uimetadata-lib`, `../backend-auth-lib`, `../backend-realtime-lib`.

---

## 1. Backend — Web Service (Spring Boot, Docker)

1. [Render Dashboard](https://dashboard.render.com/) → **New** → **Web Service**.
2. Connect the repository that contains `render/Dockerfile.backend-hospital`.
3. **Name:** e.g. `hospital-backend`.
4. **Region:** your choice (e.g. Oregon).
5. **Branch:** `main` (or your default branch).
6. **Root directory:** leave **empty** (repository root).
7. **Runtime:** **Docker**.
8. **Dockerfile path:** `render/Dockerfile.backend-hospital`
9. **Docker build context:** `.` (single dot = repo root).
10. **Instance type:** choose **Free** if available; otherwise the smallest paid tier you accept.
11. **Health check path (optional):** `/api/medical-department/get`
12. **Environment** → **Environment variables**:

| Key | Value |
|-----|--------|
| `SPRING_DATA_MONGODB_URI` | MongoDB connection string (e.g. Atlas). |
| `APP_AUTH_JWT_SECRET` | Long random secret (at least 32 bytes). |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | **Required** for the browser: comma‑separated **origin** patterns, **no path**, **no trailing slash** — e.g. `https://oshu-ai-clinic-ui.onrender.com,https://*.onrender.com,http://localhost:5173`. The backend’s `WebCorsConfig` splits on commas. If you omit your UI or mis-type the origin, preflight fails with “No `Access-Control-Allow-Origin` header”. **Redeploy the API** after changing this. |
| `APP_AUTH_COOKIE_SECURE` | `true` |

Optional:

| Key | Example |
|-----|--------|
| `APP_MONGODB_DATABASE` | `flexshell` (default if omitted) |
| `APP_HOSPITAL_TIME_ZONE` | e.g. `America/New_York` |

See `backend-hospital/src/main/resources/application.properties` for more `APP_*` keys.

13. **Create Web Service** and wait until the service is **Live**.
14. Copy the public URL, e.g. `https://hospital-backend-xxxx.onrender.com` (**no trailing slash**).

---

## 2. Frontend — Static Site

1. **New** → **Static Site** (not “Web Service”).
2. Same repository and branch as the backend.
3. **Name:** e.g. `hospital-frontend`.
4. **Root directory:** leave **empty**.
5. **Build command:** `cd frontend-hospital && npm run build:render`  
   This script runs `npm install` (not `npm ci`) then `vite build` — do **not** use `npm ci` on Render; it often fails on optional/native transitive deps. Local check: from `frontend-hospital` run `npm run build:render`.
6. **Publish directory:** `frontend-hospital/dist`
7. **Environment variables:**

| Key | Value |
|-----|--------|
| `VITE_SPRING_API_BASE_URL` | Backend URL from step 1, e.g. `https://hospital-backend-xxxx.onrender.com` (no trailing slash). |
| `VITE_PUBLIC_SITE_URL` | **This static site’s** public URL, e.g. `https://oshu-ai-clinic-ui.onrender.com` (no trailing slash). Required for best **WhatsApp / iMessage** link previews: injects `og:url` / canonical and uses `/og-share.jpg` on the same host as `og:image`. |

8. **Create Static Site** and wait for a successful deploy.
9. Open the static URL and smoke-test the app.

---

## 3. CORS (after both URLs exist)

1. Open the **backend** Web Service → **Environment**.
2. Set `APP_CORS_ALLOWED_ORIGIN_PATTERNS` to your **exact** static site origin, e.g. `https://hospital-frontend-xxxx.onrender.com`.
3. Save and **Manual Deploy** the backend so CORS updates apply.

---

## 4. Changing the API URL later

`VITE_SPRING_API_BASE_URL` is baked in at **build** time. If you change it on Render, trigger a **new deploy** of the static site so it rebuilds.

---

## 5. Quick checklist

| Item | Backend | Frontend |
|------|---------|----------|
| Render product | **Web Service** | **Static Site** |
| Root directory | *(empty)* | *(empty)* |
| Build | Docker (image from Dockerfile) | `cd frontend-hospital && npm run build:render` |
| Output / run | From Dockerfile (`java -jar` …) | Publish: `frontend-hospital/dist` |

---

## Local development

You do **not** need Docker on your laptop for daily work. Use Gradle / your IDE for `backend-hospital` and `npm run dev` in `frontend-hospital`. Docker on Render is only how the **hosted** API is built and run.

Optional local check: `docker build -f render/Dockerfile.backend-hospital -t hospital-backend:local .` from the repo root (requires Docker).

---

## Hospital video: built-in WebRTC vs Agora

The hospital app supports **built-in** video (STOMP signaling + `RTCPeerConnection`, unchanged from the legacy stack) or **Agora** (server-minted RTC token; STOMP is still used for invite/accept/end). The server property and the static-site build-time variable must describe the same mode.

| Mode | Backend (Render / local) | Frontend (static / `frontend-hospital/.env`) | Notes |
|------|---------------------------|-----------------------------------------------|--------|
| **Built-in** (default) | `APP_VIDEO_PROVIDER=builtin` or omit | `VITE_VIDEO_PROVIDER=builtin` or omit | Uses `/user/queue/webrtc` for offer/answer/ICE. Configure `VITE_ICE_SERVERS_JSON` / TURN as before. |
| **Agora** | `APP_VIDEO_PROVIDER=agora`, plus `APP_VIDEO_AGORA_APP_ID`, `APP_VIDEO_AGORA_APP_CERTIFICATE`, optional `APP_VIDEO_AGORA_TOKEN_TTL_SECONDS` | `VITE_VIDEO_PROVIDER=agora` | After login, the popup runs `POST /api/hospital/video/session` (cookie auth) before the STOMP invite. STOMP offer/answer/ICE are not written into the Pinia store. |

**Manual smoke matrix**

1. **Built-in doctor–patient:** both sides `builtin` — place call from dashboard, accept, confirm local and remote video, end call.
2. **Agora:** both sides `agora`, valid Agora app + certificate on the API — same flow; confirm both join the same channel (see Agora console).
3. **Mismatch guard:** UI `agora` with API `builtin` still runs STOMP media if you force it — keep **server and `VITE_VIDEO_PROVIDER` aligned** for production.

Git reference for the pre-abstraction stack: tag `legacy/hospital-webrtc-stomp-2026-04-18` (message lists the main file paths).

---

## Blueprint alternative

This repo also includes `render.yaml` for [Render Blueprints](https://render.com/docs/infrastructure-as-code). Static sites in Blueprints must not set `region` or `plan`; Docker services may need the instance type adjusted in the dashboard after creation.
