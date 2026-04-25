# Backend Hospital — repository context

## Purpose

Spring Boot **3.4** (Java **17**) API for the hospital vertical: REST + WebSocket realtime, JWT/cookie auth (via shared `backend-auth-lib`), UI metadata (MongoDB + `backend-uimetadata-lib`), and hospital domain (appointments, medical departments, doctor directory, admin bootstrap).

## Tech stack

- **Spring Web**, **Security**, **WebSocket**, **Data MongoDB**, **Validation**
- **JJWT** for JWT handling
- Internal libs: `backend-uimetadata-lib`, `backend-auth-lib`, `backend-realtime-lib`

## Configuration

- `src/main/resources/application.properties` — port **8080**, JWT and cookie settings, CORS patterns, optional Mongo via env (`SPRING_DATA_MONGODB_URI` or `MONGODB_URL` + password; app avoids localhost Mongo when unset)
- `SecurityConfig` — stateless session; public: `/api/auth/**`, `/api/setup/**`, `/api/logs/**`, ui metadata typo path `/api/uiMetdata/**`, read-only medical department get; admin routes require `ADMIN`
- Bootstrap/seed: `app.bootstrap.admin.*`, `app.seed.users.*`

## Main domain surface

| Concern | Java package / area | REST (representative) |
|--------|---------------------|-------------------------|
| Appointments | `appointment`, `AppointmentController` | `/api/appointment/*` |
| Medical departments | `medicaldepartment`, `MedicalDepartmentController` | `/api/medical-department/*` |
| Doctor directory | `service` `DoctorDirectoryService`, `DoctorDirectoryController` | `/api/doctor/*` |
| Auth | `auth`, `service.AuthService` | `/api/auth/*` (via libs) |
| Admin / roles | `service` admin services, `AdminRoleController`, `InitialAdminController` | `/api/admin/*`, `/api/setup/*` |
| UI metadata | `uimetadata`, `UiMetadataService` | `/api/uiMetdata` |
| Logging | `logging`, `LogController` | `/api/logs/*` |
| Realtime | `realtime.*` (chat, WebRTC WS) | chat/support/WebRTC endpoints (see package docs) |
| Smart AI chat | `controller.AiChatController`, `service.AiChatService`, `ai.*` | `/api/hospital/ai/chat` |
| Compliance | `compliance` | reserved / policy hooks |

## Layered context (package-level)

| Package / area | File |
|----------------|------|
| `appointment` | `docs/context/appointment/context.md` |
| `auth` | `docs/context/auth/context.md` |
| `config` | `docs/context/config/context.md` |
| `controller` + DTOs | `docs/context/controller/context.md` |
| `logging` | `docs/context/logging/context.md` |
| `medicaldepartment` | `docs/context/medicaldepartment/context.md` |
| `realtime` | `docs/context/realtime/context.md` |
| `service` | `docs/context/service/context.md` |
| `uimetadata` | `docs/context/uimetadata/context.md` |
| `compliance` | `docs/context/compliance/context.md` |

## Agent workflow (this repo)

1. **Before** answering questions or editing: read this file, then `docs/context/<package>/context.md` for the packages you will modify.
2. **After** substantive changes: update those package `context.md` files and this index if APIs, security rules, or configuration change.

---

*Last updated: 2026-04-22 — includes Smart AI chat endpoint/context.*
