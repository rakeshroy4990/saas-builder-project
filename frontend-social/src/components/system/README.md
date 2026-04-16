# System UI Layer

System components provide global UX wrappers independent of domain pages.

## Components

- `GlobalPopup.vue`: generic popup host; renders error state or dynamic popup page.
- `GlobalToast.vue`: global notification UI.
- `NotFound.vue`: fallback route page.

## Guidelines

- Keep these generic and package-agnostic.
- Use stores (`usePopupStore`, `useToastStore`) for state.
- Do not hardcode e-commerce/hospital/social details.
