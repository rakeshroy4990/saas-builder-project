import type { Page } from '@playwright/test';

function jsonBody(payload: unknown): string {
  return JSON.stringify(payload);
}

const corsPreflightHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*'
};

/**
 * Stub Spring-shaped JSON for hospital smoke tests so preview does not need a live API.
 * Matches common `{ Data | data }` envelope reads in services.
 */
export async function installHospitalApiMocks(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method();
    const url = req.url();

    const fulfillJson = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: jsonBody(body)
      });

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsPreflightHeaders });
      return;
    }

    if (url.includes('/api/medical-department/')) {
      await fulfillJson(200, { Success: true, Data: [], data: [] });
      return;
    }

    if (url.includes('/api/appointment/get')) {
      await fulfillJson(200, {
        Success: true,
        Data: { content: [], totalElements: 0, totalPages: 1 },
        data: { content: [], totalElements: 0, totalPages: 1 }
      });
      return;
    }

    if (url.includes('/api/appointment/booking/available-slots') || url.includes('/api/appointment/available-slots')) {
      await fulfillJson(200, { Success: true, Data: { Slots: [], slots: [] }, data: { Slots: [], slots: [] } });
      return;
    }

    if (url.includes('/api/doctor/list-active')) {
      await fulfillJson(200, { Success: true, Data: [], data: [] });
      return;
    }

    if (url.includes('/api/doctor/get')) {
      await fulfillJson(200, { Success: true, Data: {}, data: {} });
      return;
    }

    if (url.includes('/api/doctor/schedule')) {
      await fulfillJson(200, { Success: true, Data: {}, data: {} });
      return;
    }

    if (url.includes('/api/uiMetdata')) {
      await fulfillJson(200, { Success: true, Data: {}, data: {} });
      return;
    }

    if (url.includes('/api/logs/batch') || url.includes('/api/logs/level')) {
      await fulfillJson(200, { Success: true, Data: null, data: null });
      return;
    }

    if (url.includes('/api/user') && !url.includes('/api/user/profile')) {
      await fulfillJson(200, {
        Success: true,
        Data: { Email: 'mock@example.com', FirstName: 'Mock', LastName: 'User' },
        data: { Email: 'mock@example.com', FirstName: 'Mock', LastName: 'User' }
      });
      return;
    }

    if (url.includes('/api/auth/login') && method === 'POST') {
      await fulfillJson(401, { Success: false, Message: 'Invalid email or password', code: 'AUTH_FAILED' });
      return;
    }

    if (url.includes('/api/auth/register') && method === 'POST') {
      await fulfillJson(201, { Success: true, data: { RoleStatus: 'ACTIVE' } });
      return;
    }

    if (url.includes('/api/auth/refresh') && method === 'POST') {
      await fulfillJson(401, { Success: false, Message: 'Invalid or expired token, Please login again.' });
      return;
    }

    await fulfillJson(200, { Success: true, Data: null, data: null, Message: 'mock' });
  });
}
