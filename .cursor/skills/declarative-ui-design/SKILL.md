---
name: declarative-ui-design
description: >-
  Guides distinctive dynamic declarative UI (Vue + config-driven layers), design
  systems and tokens, accessible composable components, Pinia state patterns, and
  performance checks. Use when building or refactoring metadata-driven pages,
  ecommerce/config UIs, layers.ts or pages.ts, stores, Tailwind theming, or when
  the user asks for design system, component architecture, or frontend performance
  in this repo.
---

# Declarative UI, design system, components, Pinia, performance

This skill combines practices from the reference sources below. Apply it when changing `frontend/src/configs`, `frontend/src/components`, `frontend/src/store`, or global styling.

## Reference sources (install / full docs)

| Area | Source |
|------|--------|
| Distinctive UI and CSS direction | [frontend-design (anthropics/skills)](https://skills.sh/anthropics/skills/frontend-design) |
| Design system and tokens | [design-system (affaan-m/everything-claude-code)](https://skills.sh/affaan-m/everything-claude-code/design-system) |
| Composable, accessible components | [building-components (vercel/components.build)](https://skills.sh/vercel/components.build/building-components) |
| Pinia patterns | [vue-pinia-best-practices (vuejs-ai/skills)](https://skills.sh/vuejs-ai/skills/vue-pinia-best-practices) |
| Performance | [performance-optimization (supercent-io/skills-template)](https://skills.sh/supercent-io/skills-template/performance-optimization) |

More detail: [references.md](references.md).

---

## 1. Dynamic UI and CSS (frontend-design mindset)

Before editing config or components:

1. **Purpose**: Who uses the screen and what job does it do?
2. **Tone**: Pick one intentional direction (e.g. editorial, utilitarian, soft retail, brutalist). Avoid default “purple gradient + Inter” unless the brand demands it.
3. **Differentiation**: One memorable choice (typography pair, asymmetric layout, or strong color story).

**For this repo specifically**

- Visual structure lives in **config** (`StyleConfig` classes, `layers.ts`). Prefer changing tokens + layer builders over one-off primitives.
- Primitives stay **dumb** (props/events only); smart binding stays in **renderer** (`DynamicComponent.vue`).
- Use **CSS variables** in `src/styles.css` or Tailwind `@theme` for brand colors/spacing so config can reference semantic utilities or a small set of custom classes.

**Avoid generic “AI slop”**

- No gratuitous purple-on-white defaults without brand reason.
- No cookie-cutter centered hero unless the design direction calls for it.

---

## Standard UI chrome and main outlet (header + outlet pattern)

Ecommerce (and similar) pages should use one **shell** so every route shares the same header/menu/footer and only the **main body** changes (like `RouterView` for config).

**Implementation** (`frontend/src/configs/ecommerce/layers.ts`):

| Helper | Role |
|--------|------|
| `createHeaderLayer` | Site chrome: icon, title, nav, search, login, cart |
| `createMenuLayer` | Secondary nav from data |
| `createStandardMainOutlet` | Wrapper whose **children** are page-specific content only (the “outlet”) |
| `buildStandardUiChrome` | Returns `[header, menu?, mainOutlet, footer?]` in order |

**Usage in `pages.ts`**

```ts
children: buildStandardUiChrome('page-id-prefix', [
  /* only blocks unique to this page: hero, lists, forms */
])
```

- Use a **unique** `idPrefix` per page (`home`, `cart`, `checkout`) so component `id`s stay unique.
- Popups / minimal dialogs that should not show global chrome: **do not** use `buildStandardUiChrome`; keep a flat `children` list.
- To hide menu or footer on a route: `buildStandardUiChrome(prefix, outlet, { includeMenu: false })` or `includeFooter: false`.

Treat the outlet array as the only place “screen content” belongs; keeps layout consistent with the [building-components](https://skills.sh/vercel/components.build/building-components) idea of composable regions.

---

## 2. Design system (tokens + consistency)

When adding or changing global look:

1. **Extract** recurring values: colors, type scale, radius, shadow, spacing rhythm.
2. **Define tokens** (e.g. `--color-surface`, `--radius-card`) in one place; map Tailwind theme or utilities to those tokens.
3. **Document** in `frontend/` docs only if the user asks; otherwise keep tokens in code (`styles.css` / `tailwind.config.js`).
4. **Audit** after changes: same buttons/cards use same radius and shadow; hierarchy is clear (display vs body).

Output pattern when generating a full system: tokens file + short rationale (per design-system skill workflow).

---

## 3. Building UI components (accessibility + composition)

When adding a new **primitive** or **block**:

- **Taxonomy**: primitive → component → block → template; keep primitives smallest.
- **API**: clear props; emit events upward; avoid store/API inside primitives in this architecture.
- **Accessibility**: labels for inputs, focusable controls, keyboard for interactive elements, sufficient contrast.
- **Polymorphism**: use consistent patterns (e.g. `as` or variant props) only if the codebase already uses them; do not introduce new patterns casually.

Registry: register new dynamic types in `AppBootstrap` / `ComponentRegistry` only after the primitive is stable.

---

## 4. Pinia (this project)

- **Scope**: `useAppStore` holds `data[packageName][key]`; services write, mappings read. Do not bypass for domain data.
- **Reactivity**: do not destructure store state in a way that breaks reactivity; use `storeToRefs` or access `store.property` in templates.
- **Initialization**: avoid calling stores outside Pinia lifecycle (e.g. at module top level before `app.use(pinia)`).
- **Ephemeral UI**: popups/toasts/loading use dedicated stores; keep session flags out of `useAppStore` unless they are true shared domain state.

---

## 5. Performance optimization

**Measure before large refactors** (Lighthouse / Web Vitals when shipping).

For this codebase:

- **Lists**: large `list` configs many children → prefer pagination or virtualized patterns if performance regresses.
- **Images**: lazy loading and appropriate `sizes`/`src` for hero vs thumbnails; avoid huge uncropped assets in config.
- **Bundle**: lazy-load heavy routes or rare modals if added later.
- **Re-renders**: keep renderer logic pure where possible; avoid unnecessary deep object churn in store updates.

---

## Workflow checklist (agent)

When implementing a new screen or redesign:

- [ ] Chosen aesthetic direction and token updates (if needed).
- [ ] Full pages use `buildStandardUiChrome` + outlet children unless the screen is a bare dialog.
- [ ] Layers or page config updated; primitives unchanged unless new type needed.
- [ ] New components registered; a11y for interactive elements.
- [ ] Store writes only in services; mappings documented in config.
- [ ] Build passes; quick sanity check on LCP/heavy lists if the page is image- or list-heavy.

---

## When to read references.md

Open [references.md](references.md) for install commands (`npx skills add ...`) and one-line reminders per upstream skill.
