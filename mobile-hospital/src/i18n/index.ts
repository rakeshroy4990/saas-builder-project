import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LocaleCode } from '@saas-builder/i18n-contract';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import { persistLocale, readStoredLocaleIfSet, resolveInitialLocale } from './locale';

const DEFAULT_LOCALE: LocaleCode = 'en';

const I18N_RESOURCES = {
  en: { translation: en },
  hi: { translation: hi },
  kn: { translation: kn }
} as const;

let initPromise: Promise<void> | null = null;

/** Sync bootstrap so first paint (brand splash) can resolve `t()` keys. */
function bootstrapI18nSync(): void {
  if (i18n.isInitialized) return;

  const device = resolveInitialLocale(
    Localization.getLocales()[0]?.languageCode ?? DEFAULT_LOCALE
  );

  i18n.use(initReactI18next).init({
    lng: device,
    fallbackLng: DEFAULT_LOCALE,
    resources: I18N_RESOURCES,
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });
}

/** Apply persisted locale after SecureStore read (may differ from device default). */
export async function initMobileI18n(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    bootstrapI18nSync();

    const stored = await readStoredLocaleIfSet();
    const device = resolveInitialLocale(
      Localization.getLocales()[0]?.languageCode ?? DEFAULT_LOCALE
    );
    const lng = stored ?? device;

    if (stored && stored !== i18n.language?.split('-')[0]) {
      await i18n.changeLanguage(stored);
    }
    await persistLocale(lng);
  })();
  return initPromise;
}

bootstrapI18nSync();
void initMobileI18n();

export default i18n;
