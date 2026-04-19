# @saas-builder/playwright-core

Shared defaults for **Playwright** end-to-end tests in this monorepo’s Vue frontends.

## Usage in a frontend package

1. Add dependencies:

```json
"devDependencies": {
  "@playwright/test": "^1.50.0",
  "@saas-builder/playwright-core": "file:../packages/playwright-core"
}
```

2. Add scripts:

```json
"scripts": {
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

3. Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';
import { basePlaywrightPartial, vitePreviewWebServer } from '@saas-builder/playwright-core';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  ...basePlaywrightPartial({ defaultPort: 4173 }),
  testDir: 'e2e',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: vitePreviewWebServer({ port: 4173, cwd: dir })
});
```

## Environment

| Variable | Purpose |
|----------|---------|
| `PLAYWRIGHT_BASE_URL` | Override the origin under test (must match preview `host:port`). |
| `CI` | When set, `forbidOnly` is enabled, retries on, `reuseExistingServer` off. |
| `E2E_MOCK_API` | Hospital E2E: API mocks are **on** by default (`!== '0'`). Set `0` only when using a real API with CORS/proxy configured. |

Local first run: `npx playwright install` once per machine.
