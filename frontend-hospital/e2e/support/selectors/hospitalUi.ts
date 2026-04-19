import type { Locator, Page } from '@playwright/test';

/**
 * Locates a control by the suffix of its DOM `id`, which follows the renderer rule
 * `${idScope}--${definition.id}` (see `resolveComponentDomId` in app source). The page root
 * `idScope` changes per route, but `definition.id` is stable in config, so the `--suffix`
 * pattern stays stable without adding test-only attributes to production.
 */
export function byDefinitionIdSuffix(scope: Page | Locator, definitionId: string): Locator {
  return scope.locator(`[id$="--${definitionId}"]`);
}

export function popupPanel(page: Page): Locator {
  return page.locator('#system-popup-panel');
}

export function headerLoginTrigger(page: Page): Locator {
  return byDefinitionIdSuffix(page, 'hospital-public-header-login');
}

export function loginPopupRegisterLink(page: Page): Locator {
  return byDefinitionIdSuffix(popupPanel(page), 'hospital-login-popup-register-link');
}

export function loginPopupResetLink(page: Page): Locator {
  return byDefinitionIdSuffix(popupPanel(page), 'hospital-login-popup-reset-password-link');
}

export function registerPopupCancel(page: Page): Locator {
  return byDefinitionIdSuffix(popupPanel(page), 'hospital-register-popup-cancel');
}
