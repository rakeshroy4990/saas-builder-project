# Router (`src/router`)

## Role

Vue Router setup: **single dynamic page** pattern for declarative UI.

## Routes (`index.ts`)

- `/` → redirect to `/page/<defaultPackage>/<defaultPageId>` (env: `VITE_DEFAULT_PACKAGE_NAME`, `VITE_DEFAULT_PAGE_ID`)
- `/page/hospital` → `/page/hospital/home`
- `/page/hospital/book-appointment` → `/page/hospital/home` (legacy cleanup)
- `/page/:packageName/:pageId` → **`DynamicPage`**
- Catch-all → `NotFound`

## HTTP integration

`bindHttpRouter(router)` from `services/http/apiClient` runs during startup (see `main.js`).

---

*Last updated: 2026-04-18*
