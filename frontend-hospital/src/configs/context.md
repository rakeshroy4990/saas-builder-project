# Configs (`src/configs`)

## Role

Per-vertical **page and layout config** consumed by `PageRegistry`. This app ships **hospital** as the primary vertical; **ecommerce** and **social** folders may exist for shared patterns or legacy—**hospital** is what `HospitalModule` loads.

## Hospital

- See `configs/hospital/context.md` for `pages.ts` and hospital-specific layout keys.

## Conventions

Pages are data structures (ids, layers, actions) aligned with `core/types` and the renderer—not hand-rolled routes per screen.

---

*Last updated: 2026-04-18*
