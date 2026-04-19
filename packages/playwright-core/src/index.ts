import type { PlaywrightTestConfig } from '@playwright/test';

export type VitePreviewWebServerOptions = {
  /** Preview port (must match PLAYWRIGHT_BASE_URL if set). */
  port?: number;
  host?: string;
  /** Working directory for `npm run build` / `preview` (usually the frontend package root). */
  cwd?: string;
  /** Extra ms for first build on cold CI. */
  timeoutMs?: number;
};

/**
 * Default timeouts, reporters, and `use` options shared across frontend E2E packages.
 * Spread into `defineConfig({ ... })` and add `testDir`, `projects`, `webServer`.
 */
export function basePlaywrightPartial(opts: { defaultPort?: number } = {}): Pick<
  PlaywrightTestConfig,
  'fullyParallel' | 'forbidOnly' | 'retries' | 'workers' | 'reporter' | 'use' | 'timeout'
> {
  const port = opts.defaultPort ?? 4173;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
  return {
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: [
      ['list'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }]
    ],
    use: {
      baseURL,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'off'
    },
    timeout: 60_000
  };
}

/** `vite build` + `vite preview` for stable E2E against production bundle. */
export function vitePreviewWebServer(options: VitePreviewWebServerOptions = {}): PlaywrightTestConfig['webServer'] {
  const port = options.port ?? 4173;
  const host = options.host ?? '127.0.0.1';
  const timeout = options.timeoutMs ?? 180_000;
  return {
    command: `npm run build && npm run preview -- --host ${host} --port ${String(port)}`,
    url: `http://${host}:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout,
    cwd: options.cwd
  };
}
