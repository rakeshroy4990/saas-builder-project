# Components Layer

This directory is split into three sub-layers:

- `renderer/` (smart containers)
- `primitives/` (dumb/pure components)
- `system/` (global UX components like popup/toast/not-found)

## UI Construction Flow

`DynamicPage` -> `DynamicContainer` -> `DynamicComponent` -> primitive component.

The renderer decides _what_ to render and _what data/actions_ to pass.
Primitives decide _how_ the HTML is displayed.

## Standards

- Keep business logic out of primitives.
- Keep API calls out of all component files.
- Use config-driven rendering whenever possible.
