import { createPinia } from 'pinia';

/**
 * Single shared Pinia instance for app + service-layer store access.
 * Do not store JWTs or refresh tokens in Pinia — auth uses httpOnly cookies only.
 * Production builds set `__VUE_PROD_DEVTOOLS__: false` (see vite.config.js) so Vue/Pinia devtools hooks stay inert.
 */
export const pinia = createPinia();

