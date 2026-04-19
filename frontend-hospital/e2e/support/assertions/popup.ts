import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function expectPopupOpen(page: Page): Promise<void> {
  await expect(page.locator('#system-popup-panel')).toBeVisible();
}

export async function expectPopupClosed(page: Page): Promise<void> {
  await expect(page.locator('#system-popup-backdrop')).toHaveCount(0);
}

export async function clickPrimaryPopupButton(page: Page): Promise<void> {
  const panel = page.locator('#system-popup-panel');
  await panel.locator('button').filter({ hasText: /^Login$/i }).first().click();
}
