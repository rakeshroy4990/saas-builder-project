# Core Framework Layer

`src/core` contains framework internals that power dynamic declarative UI.

## Sub-layers

- `types/`: contracts for page, component, action, mapping, style, service.
- `registry/`: runtime registries (`PageRegistry`, `ServiceRegistry`, `ComponentRegistry`).
- `engine/`: data mapping, style resolution, condition evaluation, action execution.
- `bootstrap/`: startup registration of components/templates/modules.

## Why This Exists

The core layer isolates framework mechanics from domain configs, so domains can be swapped by changing config/module registration only.

## Extension Checklist

1. Add/adjust type contracts.
2. Update engine behavior.
3. Keep renderer and primitives thin.
4. Verify with unit tests under `engine/__tests__`.
