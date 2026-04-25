# Hospital-Based Domain Bootstrap Scaffold

This scaffold defines the baseline architecture to spin up a new domain variant (for example, ecommerce or social) from the `hospital` implementation while preserving shared engine/auth/security patterns.

## 1) Bootstrap outcome

For a new `<domain>` variant, keep these modules as shared and unchanged:

- Frontend engine/runtime: registries, renderer, store primitives, router shell (`frontend-<domain>/src/core`, `components/renderer`, `store`, `router`).
- Backend platform layers: auth/security, logging, ui metadata, common response envelope (`backend-<domain>/src/main/java/com/flexshell/auth|config|logging|uimetadata|controller/dto/StandardApiResponse`).
- Shared libs: `backend-auth-lib`, `backend-realtime-lib`, `backend-uimetadata-lib`, `frontend-realtime-lib`.

Replace only domain-facing modules:

- Frontend page config and domain services.
- Backend domain entities, repositories, services, controllers, and DTOs.

## 2) Domain scaffold structure

Use this file tree as the minimum bootstrap target for each new domain:

```text
frontend-<domain>/
  src/
    configs/<domain>/
      pages.ts                  # replace
      (optional layout helpers) # replace
    services/domain/<domain>/
      index.ts                  # replace service composition
      services.ts               # export alias
      <feature>/*Service.ts     # replace workflows
    modules/
      <Domain>Module.ts         # replace imports only
    core/bootstrap/AppBootstrap.ts
      # keep shared component registry wiring; only switch module registration import

backend-<domain>/
  src/main/java/com/flexshell/
    controller/
      <Domain*>Controller.java  # replace
      dto/<Domain*>*.java       # replace
      dto/StandardApiResponse.java # keep
    service/
      <Domain*>Service.java     # replace
    <domainpackage>/
      <Domain*>Entity.java      # replace
      <Domain*>Repository.java  # replace
    auth/                       # keep shared auth contracts
    config/                     # keep security/cors baseline, tune endpoint rules only
    logging/                    # keep
    uimetadata/                 # keep
```

## 3) Replacement-point map

### Frontend replacements

1. `frontend-hospital/src/configs/hospital/pages.ts`
   - Replace with `<domain>` page graph and `packageName`.
2. `frontend-hospital/src/services/domain/hospital/index.ts`
   - Replace domain workflow registration list with `<domain>` service groups.
3. `frontend-hospital/src/modules/HospitalModule.ts`
   - Keep the registry pattern, replace imported `pages` and `services` module names.
4. `frontend-hospital/src/core/bootstrap/AppBootstrap.ts`
   - Keep component registration; replace only the domain module import (`register<Domain>Module`).

### Backend replacements

1. Domain controllers in `backend-hospital/src/main/java/com/flexshell/controller`
   - Replace hospital-specific controllers (`AppointmentController`, `DoctorDirectoryController`, `StructuredPrescriptionController`, etc.) with `<domain>` controllers.
2. Domain services in `backend-hospital/src/main/java/com/flexshell/service`
   - Replace hospital workflows (`AppointmentService`, `DoctorScheduleService`, `MedicalDepartmentService`, etc.) with `<domain>` workflows.
3. Domain entities/repositories in packages like:
   - `appointment/*`, `medicaldepartment/*`, `doctorschedule/*`, `prescription/*`
   - Replace with `<domain>` bounded context packages and persistence models.
4. Keep shared contracts and gatekeeping:
   - `controller/dto/StandardApiResponse.java`
   - Auth/security flows (`SecurityConfig`, JWT services, bearer/cookie behavior)
   - Logging and ui metadata modules.

## 4) Workflow mapping checklist

When replacing workflows, map each hospital workflow to a `<domain>` equivalent:

- **Read/list flow**: controller endpoint -> service query -> repository -> DTO mapping.
- **Create/update flow**: controller validation -> service rules -> entity persistence -> standard response envelope.
- **Role-protected flow**: security rule + auth principal checks + domain authorization decision.
- **Realtime flow (if needed)**: keep shared transport adapter pattern; replace domain permission evaluator and payload model.

## 5) Definition of done for bootstrap

A domain scaffold is considered ready when all are true:

- `<domain>` pages render through `PageRegistry` with valid `packageName`.
- `<domain>` services are registered in deterministic order and action IDs resolve.
- Backend exposes at least one CRUD controller + service + entity path using `StandardApiResponse`.
- Shared auth/security/logging/uimetadata modules remain intact and build without divergence from hospital baseline.

## 6) Generator script

Use the scaffold generator to create starter files from `replacement-points.yaml`:

```bash
scripts/bootstrap-domain.sh --domain <domain>
```

Useful flags:

- `--dry-run`: preview directories/files without writing.
- `--map <path>`: use a custom replacement map file.
