import { createI18n } from 'vue-i18n';
import type { Composer, I18n } from 'vue-i18n';
import { bindDocumentLocaleAndStorage } from './documentLocale';
import { readInitialLocale } from './initialLocale';
import { loadLocaleMessages } from './loadLocaleMessages';
import type { LocaleCode } from '@saas-builder/i18n-contract';

const initial = readInitialLocale();

export const i18n: I18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initial,
  fallbackLocale: 'en',
  fallbackWarn: import.meta.env.DEV,
  missingWarn: import.meta.env.DEV,
  messages: {}
});

let documentBindingDone = false;

/** Call once before `app.mount` so first paint has messages + html attrs. */
export async function initI18n(): Promise<void> {
  await loadLocaleMessages(i18n, 'en');
  await loadLocaleMessages(i18n, initial);
  if (!documentBindingDone) {
    bindDocumentLocaleAndStorage(i18n);
    documentBindingDone = true;
  }
}

export async function setAppLocale(next: LocaleCode): Promise<void> {
  await loadLocaleMessages(i18n, next);
  (i18n.global as Composer).locale.value = next;
}
