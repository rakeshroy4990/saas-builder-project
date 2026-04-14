# Modules Layer

Modules register package-specific pages and services into global registries.

## Files

- `EcommerceModule.ts`
- `HospitalModule.ts`
- `SocialModule.ts`

## Responsibility

- Import package configs and services.
- Register them into `PageRegistry` and `ServiceRegistry`.
- Keep package wiring isolated from renderer/core internals.

`AppBootstrap` picks active module at startup using environment settings.
