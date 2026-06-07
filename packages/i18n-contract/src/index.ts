/**
 * On-disk convention (all FlexShell frontends): `src/locales/<lng>/messages.json`
 * or split JSON merged at build time — keep BCP-47 primary subtags as folder names.
 *
 * Backends: send user-visible strings already localized using the `Accept-Language`
 * header (e.g. `hi`, `en`, `en-IN`), or return stable error codes and let the client map.
 */

export const FLEXSHELL_LOCALE_STORAGE_KEY = 'flexshell.locale.v1';

export const SUPPORTED_LOCALES = ['en', 'hi', 'kn'] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export interface LocaleConfig {
  code: LocaleCode;
  /** Native-language label for selectors */
  label: string;
  /** English name for aria-labels / tooling */
  englishLabel: string;
  dir: 'ltr' | 'rtl';
  /** Optional decorative prefix in UI */
  flag?: string;
}

export const LOCALE_CONFIG: Record<LocaleCode, LocaleConfig> = {
  en: {
    code: 'en',
    label: 'English',
    englishLabel: 'English',
    dir: 'ltr',
    flag: 'EN'
  },
  hi: {
    code: 'hi',
    label: 'हिन्दी',
    englishLabel: 'Hindi',
    dir: 'ltr',
    flag: 'HI'
  },
  kn: {
    code: 'kn',
    label: 'ಕನ್ನಡ',
    englishLabel: 'Kannada',
    dir: 'ltr',
    flag: 'KN'
  }
};

export function isSupportedLocale(value: string | undefined | null): value is LocaleCode {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocaleTag(tag: string | undefined | null): LocaleCode {
  const primary = String(tag ?? '')
    .trim()
    .split(/[-_]/)[0]
    ?.toLowerCase();
  if (primary && isSupportedLocale(primary)) return primary;
  return 'en';
}

/** Value for the {@code Accept-Language} HTTP header from the active app locale. */
export function acceptLanguageHeaderValue(locale: string | undefined | null): LocaleCode {
  return normalizeLocaleTag(locale);
}
