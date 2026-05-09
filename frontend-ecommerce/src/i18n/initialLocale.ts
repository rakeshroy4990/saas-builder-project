import {
  FLEXSHELL_LOCALE_STORAGE_KEY,
  isSupportedLocale,
  normalizeLocaleTag,
  type LocaleCode
} from '@saas-builder/i18n-contract';

export function readInitialLocale(): LocaleCode {
  try {
    const stored = localStorage.getItem(FLEXSHELL_LOCALE_STORAGE_KEY);
    if (isSupportedLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined') {
    return normalizeLocaleTag(navigator.language);
  }
  return 'en';
}
