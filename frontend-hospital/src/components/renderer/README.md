# Renderer Layer (Smart Containers)

This layer performs data binding and action orchestration for dynamic UI.

## Files

- `DynamicPage.vue`: resolves route params (`packageName`, `pageId`) and loads a page config.
- `DynamicContainer.vue`: recursively renders container definitions.
- `DynamicComponent.vue`: resolves component type from registry, evaluates visibility, resolves mapped data, and dispatches actions.

## Responsibilities

- Read `PageRegistry` output and drive component tree rendering.
- Resolve config mappings into runtime values (`DataMapper`).
- Execute actions via `ActionEngine` (service, navigate, popup).
- Keep recursion and conditional rendering generic.

## Must Not

- Hardcode domain-specific page structure.
- Make direct HTTP calls.
- Duplicate primitive rendering logic.

## How To Add New Dynamic Capability

1. Extend core types in `src/core/types`.
2. Add evaluation/transform logic in renderer or engine.
3. Keep primitives unchanged unless visual behavior needs expansion.
