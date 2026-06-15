import { isSupportedLocale, type LocaleCode } from '@saas-builder/i18n-contract';
import type { I18n } from 'vue-i18n';
import { expandDotKeys } from './expandDotKeys';

let i18nInstance: I18n | null = null;

/** Called once from {@code i18n/index.ts} after {@link createI18n}. */
export function attachServerI18nBundles(i18n: I18n): void {
  i18nInstance = i18n;
}

/** Optional CMS / tenant copy merged into vue-i18n at runtime. */
export type ServerI18nBundles = Record<string, Record<string, unknown>>;

let cachedBundles: ServerI18nBundles | null = null;

function normalizeLocaleMessages(raw: Record<string, unknown>): Record<string, unknown> {
  const scalars: Record<string, unknown> = {};
  const nested: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      nested[key] = normalizeLocaleMessages(value as Record<string, unknown>);
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      scalars[key] = String(value);
    }
  }

  const fromDots = Object.keys(scalars).length > 0 ? expandDotKeys(scalars) : {};
  return deepMergeLocaleTrees(fromDots, nested);
}

function deepMergeLocaleTrees(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const existing = out[key];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = deepMergeLocaleTrees(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Cache bundles from UI metadata and merge into vue-i18n (overrides shipped keys on conflict).
 */
export function setServerI18nBundles(bundles: ServerI18nBundles | undefined | null): void {
  if (!bundles || typeof bundles !== 'object' || Object.keys(bundles).length === 0) {
    return;
  }
  cachedBundles = { ...bundles };
  applyCachedServerI18nBundles();
}

/** Re-merge after {@link loadLocaleMessages} / locale switch so CMS copy stays available. */
export function applyCachedServerI18nBundles(): void {
  if (!cachedBundles || !i18nInstance) return;
  for (const [locale, messages] of Object.entries(cachedBundles)) {
    const code = locale.trim().toLowerCase();
    if (!isSupportedLocale(code) || !messages || typeof messages !== 'object') continue;
    i18nInstance.global.mergeLocaleMessage(code as LocaleCode, normalizeLocaleMessages(messages));
  }
}

export function getCachedServerI18nBundles(): ServerI18nBundles | null {
  return cachedBundles;
}

/** Clear CMS bundles from vue-i18n. */
export function clearServerI18nBundles(): void {
  cachedBundles = null;
}
