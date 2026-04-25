# Hospital config (`src/configs/hospital`)

## Role

**`pages.ts`** — large declarative registry of hospital routes under package `hospital` (home, appointments, admin flows, chat, etc.). Defines:

- Page ids and metadata used in URLs: `/page/hospital/<pageId>`
- Layers, actions, and bindings consumed by `DynamicPage` + `useActionEngine`
- Copy and static content sections (e.g. home hero) where inlined

## Related code

- Registration: `modules/HospitalModule.ts` imports `hospitalPages` from `./pages` (via `../configs/hospital/pages`)
- Behaviors that call APIs live in `services/domain/hospital/services.ts` (service definitions keyed in config)

## When you change this

- Keep **pageId** renames in sync with `router` redirects and any bookmarks/docs
- If new **action types** or **layer types** appear, update `core/types` and renderer if needed

## Header title → home

Brand title text (`hosp.header.title`) uses **`config.click`** on `type: 'text'`: `set-home-header-active` then `navigate` to `hospital` / `home` on home, dashboard, and chat pages.

## Header layout

- **`hosp.header.shell`** stacks major blocks on small screens (`flex-col`); **hamburger + brand** sit in **`hosp.header.lead`** (`flex-row`) so the menu control stays **left of the logo** on one line (home + dashboard).

## Chat pages

- `chat` and `chat-popup` now expose dual chat modes through `type: 'chat'` config:
  - Human support mode (existing realtime support flow)
  - Smart AI mode (non-diagnostic guidance via backend AI proxy)
- Chat config includes Smart AI actions (`chat-set-mode`, `chat-ai-start`, `chat-ai-send-message`) and legal disclaimer actions.

## Dashboard appointment video

The per-row **Video Call** button passes `appointmentId`, `doctorId`, `createdBy`, **`patientName`**, and **`doctorName`**. The service sets **`remotePartyName`**, `inviteToUserId`, and opens the popup with **`initKey`** so the video call actions run on every open. Details: `src/services/context.md`.

---

*Last updated: 2026-04-22*
