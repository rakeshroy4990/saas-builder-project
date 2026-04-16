# Router Layer (Presentation Entry)

Router is the presentation entry point for dynamic pages.

## Route Contract

- `/page/:packageName/:pageId`

This route does not hardcode domain pages. It always mounts `DynamicPage.vue`, which resolves page config from registry.

## Defaults

Root route redirects to env-based defaults:

- `VITE_DEFAULT_PACKAGE_NAME` (preferred)
- fallback: `VITE_DEFAULT_NAMESPACE`
- `VITE_DEFAULT_PAGE_ID`

## Guideline

Keep router concerns limited to navigation and entry mounting, not business logic.
