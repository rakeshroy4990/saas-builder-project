# Package: `com.flexshell.logging` (+ `logging.api`)

## Role

Server-side support for **client log batch** and **dynamic log level** endpoints consumed by the SPA (`URLRegistry.logsBatch`, `logsLevel`).

## Controller

- `LogController` — `/api/logs/batch`, `/api/logs/level` (public in `SecurityConfig` for development diagnostics — lock down in production if needed)

## Related

- `service.LogService` implements ingestion
- Frontend starts `startLogSyncScheduler()` on startup

---

*Last updated: 2026-04-18*
