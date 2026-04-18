# Frontend Hospital — repository context

## Purpose

Vue 3 + Vite + TypeScript SPA for the **hospital** vertical. The UI is largely **config-driven**: page definitions in `src/configs/hospital/` are registered at bootstrap and rendered by `DynamicPage` + the declarative component registry (Dyn* primitives, chat, video-call).

## Tech stack

- **Vue 3**, **Vue Router**, **Pinia**, **Axios**, **Tailwind CSS v4** (`@tailwindcss/vite`)
- **STOMP** (`@stomp/stompjs`) for realtime; Vite aliases `@realtime` → `../frontend-realtime-lib/src` for shared realtime components
- **Vitest** + jsdom for tests (`src/test/setup.ts`)

## How to run

- Dev: `npm run dev` (Vite defaults; `dev:live` binds `127.0.0.1:5174`)
- Build: `npm run build`
- API base: `VITE_SPRING_API_BASE_URL` (defaults to `http://localhost:8080` in `URLRegistry`)

## Entry & bootstrap

- `src/main.js` — starts log sync, `bootstrap()`, auth hydrate, router HTTP binding, optional UI metadata hydrate from server, then mounts the app
- `src/core/bootstrap/AppBootstrap.ts` — theme, `ComponentRegistry` + `registerHospitalModule()`
- `src/modules/HospitalModule.ts` — registers `hospitalPages` + `hospitalServices` into `PageRegistry` / `ServiceRegistry`

## Routing

- Primary route: `/page/:packageName/:pageId` → `DynamicPage.vue`
- Defaults from env: `VITE_DEFAULT_PACKAGE_NAME` / `VITE_DEFAULT_NAMESPACE`, `VITE_DEFAULT_PAGE_ID`
- Hospital shortcuts: `/page/hospital` → `home`; legacy `book-appointment` redirects to `home`

## Layered context (read before changing a zone)

| Area        | File                         | Scope |
|------------|------------------------------|--------|
| Core engine | `src/core/context.md`        | Registries, theme, bootstrap, types, engine, utils |
| Components  | `src/components/context.md`  | Renderer, primitives, system UI |
| Configs     | `src/configs/context.md`     | Package layouts; hospital pages |
| Hospital UI | `src/configs/hospital/context.md` | `pages.ts` and hospital-specific config |
| Services    | `src/services/context.md`    | HTTP, auth, domain services, realtime, media, logging |
| Router      | `src/router/context.md`    | Routes and navigation |
| Store       | `src/store/context.md`       | Pinia stores |
| Modules     | `src/modules/context.md`     | Vertical registration |
| Composables | `src/composables/context.md` | `useActionEngine` etc. |
| Builder     | `src/builder/context.md`     | `Builder.vue` |

## Agent workflow (this repo)

1. **Before** answering questions or editing: read this file, then the **`context.md` for the folder you will touch** (from the table above).
2. **After** substantive changes: update the relevant layered `context.md`(s) and this file if behavior, env vars, or stack assumptions change.

---

*Last updated: 2026-04-18 — initial context map.*
