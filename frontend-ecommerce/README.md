# Frontend Dynamic UI Architecture

This frontend uses a declarative, metadata-driven architecture where UI is built from config objects instead of hardcoded domain pages.

## How UI Is Built

1. Route resolves `packageName` + `pageId`.
2. `PageRegistry` loads matching `PageConfig`.
3. Renderer layer traverses `container.children`.
4. Smart renderer resolves data mappings and executes actions.
5. Primitive components render final markup and emit interaction events.

## Layer Responsibilities

- `src/router` + `src/App.vue`: presentation shell and route-level mounting.
- `src/components/renderer`: smart container layer (binding + orchestration).
- `src/components/primitives`: dumb/pure visual layer.
- `src/core`: framework internals (types, registries, engines, bootstrap).
- `src/configs`: declarative page definitions per domain.
- `src/services`: API integrations and service contracts.
- `src/store`: shared app state stores.
- `src/modules`: package registration wiring.

## Dynamic UI Rule

To add/modify domain UI, prefer editing `configs` + `services` first.
Avoid creating hardcoded domain-specific `.vue` pages.
