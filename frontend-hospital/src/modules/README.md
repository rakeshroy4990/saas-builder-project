# Modules Layer

Modules register package-specific pages and services into global registries.

## Files

- `HospitalModule.ts`

## Responsibility

- Import package configs and services.
- Register them into `PageRegistry` and `ServiceRegistry`.
- Keep package wiring isolated from renderer/core internals.

`AppBootstrap` registers this single module directly at startup.
