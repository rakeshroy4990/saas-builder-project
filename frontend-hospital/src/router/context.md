# Router (`src/router`)

## Role

Vue Router setup: **single dynamic page** pattern for declarative UI.

## Routes (`index.ts`)

- `/` → redirect to `/<defaultPageId>` (env: `VITE_DEFAULT_PAGE_ID`)
- `/:pageId` → **`DynamicPage`** (canonical hospital route, e.g. `/home`, `/dashboard`, `/terms`)
- `/:packageName/:pageId` → `/:pageId` (legacy redirect; removes package segment from URL)
- `/page/:packageName/:pageId` → `/:pageId` (legacy redirect; removes `/page` and package)
- Catch-all → `NotFound`

## HTTP integration

`bindHttpRouter(router)` from `services/http/apiClient` runs during startup (see `main.js`).

---

*Last updated: 2026-04-18*
