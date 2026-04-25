# Services (`src/services`)

## Role

All **HTTP**, **auth**, **domain orchestration**, **realtime**, **media uploads**, and **client logging**.

## Subfolders

| Path | Role |
|------|------|
| `http/` | `apiClient` (axios + router integration), **`URLRegistry`** — single source for `VITE_SPRING_API_BASE_URL`, path constants, `fetch` with trace id |
| `auth/` | JWTs in memory + **`sessionStorage`** key `flexshell_auth_tokens` (survives full reload); profile in `flexshell_auth_session_profile` (`authSessionStore`); `hydrateAuthTokensFromSessionStorage()` in `main.js` |
| `domain/hospital/` | **`services.ts`** — large `ServiceDefinition` map: appointments, departments, doctors, chat/STOMP, support, prescriptions, toast/popup side effects |
| `realtime/` | STOMP client, ICE/WebRTC helpers used by DynChat / video |
| `media/` | Cloudinary (e.g. uploads) |
| `logging/` | Client logs + trace id, sync scheduler started from `main.js` |

## Rules

- Prefer **`apiClient`** / **`URLRegistry`** for backend calls; avoid ad-hoc `fetch` except through `URLRegistry.request` where low-level is required.

## Login → refresh background

- Successful **`auth-login`** chains `onSuccess`: **`closePopup`** then **`reloadWindow`** (`ActionEngine`), so the SPA does a full **`window.location.reload()`** after the login modal closes.
- Tokens must survive reload: **`setAuthTokens`** persists to `sessionStorage`; startup hydrates before `hydrateAuthSessionProfile()`.
- **`closePopup`** may chain **`onSuccess`** (used for this flow only unless other configs add it).

## Video call (appointments)

- Dashboard list passes `appointmentId`, `doctorId`, `createdBy`, **`patientName`**, **`doctorName`** into `open-appointment-video-call`.
- That service sets `VideoCall.inviteToUserId`, **`remotePartyName`** (the other person’s display name for the row), then opens the popup with a unique **`initKey`** so **GlobalPopup** always re-runs `initializeActions` (STOMP connect + send invite) on each open.
- Callee user id: **patient → doctor** (`doctorId`); **assigned doctor / admin → patient** (`createdBy`). Unassigned **doctor** row is blocked.
- **`call-send-appointment-invite`** (after `call-connect`): publishes invite with `payload: { displayName: <your profile name> }` for the callee; ensures STOMP `connect` before `publish` if needed.
- Inbound **STOMP** webrtc events use **camelCase or PascalCase** field names; **`callId`** is only written when the server sent a non-empty value (avoids blank overwrites). **`remotePartyName`** is updated from `payload.displayName` when the event is from the **other** user (`fromUserId !==` you).
- **DynVideoCall** (`frontend-realtime-lib`) shows **Call with:** the person’s name; **Session ref** is a short technical id (not shown as a “user id” in the main line).

## Smart AI chat

- `chatServices.ts` now supports `chat-ai-start`, `chat-ai-send-message`, mode switching (`chat-set-mode`), and first-load disclaimer controls.
- Emergency keywords are checked client-side before API call (`chat/aiSafety.ts`), with immediate doctor-escalation messaging.
- Smart AI endpoint is `URLRegistry.paths.hospitalAiChat` (`/api/hospital/ai/chat`), and AI response text is normalized to include legal disclaimer lines.

## When you change this

Update **path keys** in `URLRegistry.ts` when backend routes change; keep `domain/hospital/services.ts` in sync with `configs/hospital/pages.ts` action names.

---

*Last updated: 2026-04-22 — Smart AI chat mode + safety utilities.*
