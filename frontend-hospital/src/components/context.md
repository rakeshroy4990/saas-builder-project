# Components (`src/components`)

## Role

Vue building blocks for the metadata-driven UI.

## Layout

- **`renderer/`** — `DynamicPage.vue` (route host), `DynamicContainer.vue` and composition that resolve config to registered components
- **`primitives/`** — `DynButton`, `DynText` (optional `config.click` emits `action` like buttons), `DynInput`, `DynDropdown`, `DynList`, `DynImage`, `DynCheckbox`, `DynRadioGroup` — mapped in `AppBootstrap`
- **`system/`** — shell UX: `NotFound`, popups, loading, chat FAB, etc.

## Realtime

`DynChat` and `DynVideoCall` are registered from `@realtime` (shared lib), not under this folder. Video UI reads `hospital` / `VideoCall` store: **`remotePartyName`**, **`callId`** (short “Session ref” in the component), **`lastSignalType`**.
`DynChat` now also supports a Smart AI mode toggle, disclaimer surface, and Terms-of-Use link rendering via config.

## When you change this

Document new **component tag names** in `core/bootstrap/AppBootstrap.ts` and here if you add primitives.

---

*Last updated: 2026-04-22*
