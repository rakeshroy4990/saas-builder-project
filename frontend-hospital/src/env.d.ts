/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to `false` to skip Firebase Analytics init (no calls to googleapis.com). */
  readonly VITE_FIREBASE_ANALYTICS_ENABLED?: string;
  /** When `true`, enables client perf overlay and axios timing (dev only). */
  readonly VITE_PERF_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
