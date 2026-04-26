# Package: `com.flexshell.service`

## Role

Application **use-case** layer: business rules orchestrating repositories, auth facade, and integrations.

## Services

| Class | Responsibility |
|-------|----------------|
| `AppointmentService` | Create/update/delete/list appointments; prescription files |
| `MedicalDepartmentService` | Departments CRUD-style operations |
| `DoctorDirectoryService` | Doctor listing for scheduling UI |
| `AuthService` | Implements `AuthFacade` from auth lib (login, refresh, roles) |
| `AdminRoleService` | Admin role request approval workflows |
| `InitialAdminService` | One-time setup admin when bootstrapping |
| `UiMetadataService` | Implements `UiMetadataFacade`; bridges to `UiMetadataPersistenceService` |
| `LogService` | Client log ingestion / level |
| `AiChatService` | Smart AI chat orchestration + emergency escalation + disclaimer enforcement through provider-routed LLM adapter |

## When you change this

Update `controller` docs if public HTTP contracts change; update `frontend-hospital` `URLRegistry` + domain services if paths or payloads change.

---

*Last updated: 2026-04-22*
