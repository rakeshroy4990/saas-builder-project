import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { resolvePageRootDomId } from '../../../src/core/utils/domId';

export async function expectNoPageNotFound(page: Page): Promise<void> {
  await expect(page.locator('#system-page-not-found')).toHaveCount(0);
}

/** Full page shell under {@link DynamicPage} (not popup). */
export async function expectHospitalPageLoaded(page: Page, pageId: string, packageName = 'hospital'): Promise<void> {
  await expectNoPageNotFound(page);
  const rootId = resolvePageRootDomId({ packageName, pageId });
  await expect(page.locator(`#${rootId}-host`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/page/${packageName}/${pageId}($|\\?|#)`));
}

export async function expectNoFatalOverlay(page: Page): Promise<void> {
  await expect(page.locator('#system-page-not-found')).toHaveCount(0);
}
