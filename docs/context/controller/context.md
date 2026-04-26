# Package: `com.flexshell.controller` (+ `controller.dto`)

## Role

REST adapters for the hospital API. DTOs in `controller/dto` wrap requests/responses and `StandardApiResponse`.

## Controllers (prefix → class)

| Base path | Controller |
|-----------|------------|
| `/api/appointment` | `AppointmentController` |
| `/api/medical-department` | `MedicalDepartmentController` |
| `/api/doctor` | `DoctorDirectoryController` |
| `/api/admin/role-requests` | `AdminRoleController` |
| `/api/setup` | `InitialAdminController` |
| `/api/logs` | `LogController` |
| `/api/test` | `TestController` |
| `/api/hospital/ai` | `AiChatController` |

Auth and UI metadata HTTP endpoints are primarily wired through **shared libraries** (`backend-auth-lib`, `backend-uimetadata-lib`) — see `auth` and `uimetadata` docs; routing is secured in `SecurityConfig`.

## When you change this

Keep paths aligned with **frontend** `URLRegistry` and integration tests under `src/test/java`.

---

*Last updated: 2026-04-22*
