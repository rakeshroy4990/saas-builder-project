import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LocaleCode } from '@saas-builder/i18n-contract';

const DEFAULT_LOCALE: LocaleCode = 'en';

import en from './locales/en.json';

void i18n.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  resources: {
    en: { translation: en }
  },
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
