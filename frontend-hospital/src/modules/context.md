# Modules (`src/modules`)

## Role

Vertical **registration** for the declarative engine.

## Hospital

`HospitalModule.ts` exports `registerHospitalModule()`:

- Registers every entry in `configs/hospital/pages.ts` with **`PageRegistry`**
- Registers every **`ServiceDefinition`** from `services/domain/hospital/services.ts` with **`ServiceRegistry`**

Invoked from `core/bootstrap/AppBootstrap.ts` during bootstrap.

---

*Last updated: 2026-04-18*
