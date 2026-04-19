import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { basePlaywrightPartial, vitePreviewWebServer } from '@saas-builder/playwright-core';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  ...basePlaywrightPartial({ defaultPort: 4173 }),
  testDir: 'e2e',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: vitePreviewWebServer({ port: 4173, cwd: packageRoot })
});
