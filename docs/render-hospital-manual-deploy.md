# Deploy hospital frontend and backend on Render (manual)

Step-by-step setup **without** a Blueprint: one **Web Service** (Docker API) and one **Static Site** (Vite). Paths match this repo (`render/Dockerfile.backend-hospital`, `render.yaml`).

**References:** [Render Dashboard](https://dashboard.render.com/) · [Docker on Render](https://render.com/docs/docker) · [Static sites](https://render.com/docs/static-sites) · [Deploy for Free](https://render.com/docs/free) · [Static redirects/rewrites (SPAs)](https://render.com/docs/redirects-rewrites)

### If the browser shows `{"message":"Missing bearer token","code":"AUTH_UNAUTHORIZED"}`

That JSON is returned only by the **Spring API** (not the Vite static files). It means the URL in the address bar is hitting the **Web Service (Docker)**, or you have only one public service and it is the API.

- On Render you should have **two** resources: a **Static Site** (Vue app) and a **Web Service** (backend). They get **two different** `https://<name>.onrender.com` URLs.
- **Open the app in the browser using the Static Site’s URL** (Render → your static site → the public URL at the top). The API URL is only for `VITE_SPRING_API_BASE_URL` and should not be the tab you use to browse `/page/...`.
- In the static site, add a **rewrite** so client-side routes work on refresh: **Source** `/*` → **Destination** `/index.html` (Rewrite, not redirect). The repo’s `render.yaml` includes this under `hospital-frontend` `routes`.

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

## Blueprint alternative

This repo also includes `render.yaml` for [Render Blueprints](https://render.com/docs/infrastructure-as-code). Static sites in Blueprints must not set `region` or `plan`; Docker services may need the instance type adjusted in the dashboard after creation.
