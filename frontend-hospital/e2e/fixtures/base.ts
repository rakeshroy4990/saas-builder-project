import { test as base } from '@playwright/test';
import { installHospitalApiMocks } from '../support/mocks/http';

/**
 * Intercept API calls in the browser so E2E does not need Spring on :8080 (avoids CORS:
 * preview is `127.0.0.1:4173` while `VITE_SPRING_API_BASE_URL` defaults to `localhost:8080`).
 * Set `E2E_MOCK_API=0` to talk to a real backend (you must fix CORS or use a same-origin proxy).
 */
const shouldMockApi = () => process.env.E2E_MOCK_API !== '0';

export const test = base.extend({
  page: async ({ page }, use) => {
    if (shouldMockApi()) {
      await installHospitalApiMocks(page);
    }
    await use(page);
  }
});

export { expect } from '@playwright/test';
