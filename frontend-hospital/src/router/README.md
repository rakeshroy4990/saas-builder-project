# Router Layer (Presentation Entry)

Router is the presentation entry point for dynamic pages.

## Route Contract

- `/:pageId` (canonical, package-less URL)
- Legacy redirects:
  - `/:packageName/:pageId` -> `/:pageId`
  - `/page/:packageName/:pageId` -> `/:pageId`

The canonical route always mounts `DynamicPage.vue`, which resolves page config from registry.

## Defaults

Root route redirects to env-based default page:

- `VITE_DEFAULT_PAGE_ID`

## Guideline

Keep router concerns limited to navigation and entry mounting, not business logic.
