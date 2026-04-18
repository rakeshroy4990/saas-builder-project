# Core (`src/core`)

## Role

Shared engine for the declarative UI: **registries** (components, pages, services), **theme** registration, **bootstrap** orchestration, **types**, and small **utils**. The **action engine** under `engine/` interprets config-driven actions (`service`, `navigate`, `showPopup`, `closePopup` — **`closePopup` may chain `onSuccess`** — and **`reloadWindow`** = full page reload).

## Key files

- `bootstrap/AppBootstrap.ts` — `registerTheme()`, maps tag names (`button`, `text`, `container`, …) to Vue components; calls `registerHospitalModule()`
- `bootstrap/hydrateUiMetadata.ts` — optional fetch of server UI metadata
- `registry/` — `ComponentRegistry`, `PageRegistry`, `ServiceRegistry` (singletons consumed by renderer and module registration)
- `theme/registerTheme.ts`, `registerStyleTemplates.ts` — design tokens / templates
- `types/` — shared TS types for pages, services, layers

## Dependencies

Import hospital module only from bootstrap (avoid cycles).

## When you change this

Update `frontend-hospital/context.md` if bootstrap order, default registries, or theme contracts change.

---

*Last updated: 2026-04-18 — `reloadWindow`, chained `closePopup`.*
