import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LocaleCode } from '@saas-builder/i18n-contract';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import { persistLocale, readStoredLocaleIfSet, resolveInitialLocale } from './locale';

const DEFAULT_LOCALE: LocaleCode = 'en';

let initPromise: Promise<void> | null = null;

export async function initMobileI18n(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const stored = await readStoredLocaleIfSet();
    const device = resolveInitialLocale(Localization.getLocales()[0]?.languageCode ?? DEFAULT_LOCALE);
    const lng = stored ?? device;

    if (!i18n.isInitialized) {
      await i18n.use(initReactI18next).init({
        lng,
        fallbackLng: DEFAULT_LOCALE,
        resources: {
          en: { translation: en },
          hi: { translation: hi },
          kn: { translation: kn }
        },
        interpolation: {
          escapeValue: false
        }
      });
    } else {
      await i18n.changeLanguage(lng);
    }
    await persistLocale(lng as LocaleCode);
  })();
  return initPromise;
}

void initMobileI18n();

export default i18n;
