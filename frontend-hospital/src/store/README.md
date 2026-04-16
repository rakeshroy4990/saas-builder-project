# Store Layer

Stores keep shared runtime state for dynamic UI.

## Stores

- `useAppStore`: package-scoped data buckets (`data[packageName][key]`).
- `usePopupStore`: global popup state.
- `useToastStore`: global toast notifications.
- `useLoadingStore`: loading flags by key.

## Data Pattern

Services own data schema and write to store.
Renderer/components consume through mappings; primitives do not access stores directly.
