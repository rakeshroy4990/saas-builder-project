# Frontend Architecture Map

This document is the quick navigation guide for the dynamic declarative UI framework in this project.

## 1) High-Level Flow

1. User lands on route: `/page/:packageName/:pageId`
2. Router mounts `DynamicPage`
3. `DynamicPage` loads config from `PageRegistry`
4. Renderer recursively resolves and mounts components
5. Smart renderer resolves data mappings and action dispatch
6. Primitive components render markup and emit UI events
7. `ActionEngine` runs service/navigation/popup logic
8. Services call backend and update stores
9. UI reacts through config mappings

## 2) Layer Map

- **Presentation entry**
  - `src/router/`
  - `src/App.vue`
  - Read: `src/router/README.md`

- **Smart container layer**
  - `src/components/renderer/`
  - Read: `src/components/renderer/README.md`

- **Dumb/pure UI layer**
  - `src/components/primitives/`
  - Read: `src/components/primitives/README.md`

- **Global system UI**
  - `src/components/system/`
  - Read: `src/components/system/README.md`

- **Core framework internals**
  - `src/core/`
  - Read: `src/core/README.md`

- **Dynamic page source**
  - `src/configs/`
  - Read: `src/configs/README.md`

- **Service/API layer**
  - `src/services/`
  - Read: `src/services/README.md`

- **State layer**
  - `src/store/`
  - Read: `src/store/README.md`

- **Domain registration**
  - `src/modules/`
  - Read: `src/modules/README.md`

## 3) Core Principles

- No hardcoded domain pages in Vue templates.
- UI is driven by config objects.
- Primitives are pure render components.
- Renderer is the smart orchestrator.
- Services are the only API boundary.
- Shared state is package-scoped (`data[packageName][key]`).

## 4) How To Build A New Dynamic Page

1. Add a new `PageConfig` in the correct package folder under `src/configs/`.
2. Add/update required `ServiceDefinition` entries under `src/services/domain/<package>/`.
3. Register pages/services in the package module under `src/modules/`.
4. Ensure bootstrap activates your module from env settings.
5. Navigate using `/page/<packageName>/<pageId>`.

## 5) How To Add A New Primitive Component Type

1. Create primitive in `src/components/primitives/`.
2. Keep it render-only and event-emitting.
3. Register it in `ComponentRegistry` via `AppBootstrap`.
4. If needed, extend renderer mapping/action transform logic.
5. Add config usage in page definitions.

## 6) Naming and Contracts

- Route contract: `packageName`, `pageId`
- Action/data contracts live under `src/core/types/`
- Env defaults:
  - `VITE_DEFAULT_PACKAGE_NAME` (preferred)
  - `VITE_DEFAULT_NAMESPACE` (backward-compatible fallback)
  - `VITE_DEFAULT_PAGE_ID`

## 7) Suggested Read Order For New Developers

1. `README.md` (project-level frontend summary)
2. `ARCHITECTURE.md` (this file)
3. `src/router/README.md`
4. `src/components/renderer/README.md`
5. `src/components/primitives/README.md`
6. `src/core/README.md`
7. `src/configs/README.md`
8. `src/services/README.md`
