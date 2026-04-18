# Store (`src/store`)

## Role

**Pinia** stores for cross-cutting UI state.

## Files

- `pinia.ts` — app-wide pinia instance
- `useAppStore.ts` — app-level state
- `useLoadingStore.ts` — loading indicators
- `useToastStore.ts` — toasts
- `usePopupStore.ts` — modals / global popups

Domain-heavy logic for hospital remains in `services/domain/hospital/services.ts`; stores are for presentation and global UX.

---

*Last updated: 2026-04-18*
