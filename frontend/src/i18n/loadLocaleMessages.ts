import type { I18n } from 'vue-i18n';
import type { LocaleCode } from '@saas-builder/i18n-contract';

const loaders = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*/messages.json');

const loadedLocales = new Set<string>();

export async function loadLocaleMessages(i18n: I18n, locale: LocaleCode): Promise<void> {
  if (loadedLocales.has(locale)) return;
  const path = `../locales/${locale}/messages.json`;
  const load = loaders[path];
  if (!load) {
    console.warn(`[i18n] No messages bundle for locale: ${locale}`);
    return;
  }
  const mod = await load();
  i18n.global.mergeLocaleMessage(locale, mod.default);
  loadedLocales.add(locale);
}
