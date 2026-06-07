import {
  FLEXSHELL_LOCALE_STORAGE_KEY,
  LOCALE_CONFIG,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  normalizeLocaleTag,
  type LocaleCode
} from '@saas-builder/i18n-contract';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';

export { LOCALE_CONFIG, SUPPORTED_LOCALES, type LocaleCode };

const LOCALE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
};

let cachedLocale: LocaleCode | null = null;

/** Returns a persisted locale when the user (or a prior session) chose one; otherwise `null`. */
export async function readStoredLocaleIfSet(): Promise<LocaleCode | null> {
  if (cachedLocale) return cachedLocale;
  try {
    const raw = await SecureStore.getItemAsync(FLEXSHELL_LOCALE_STORAGE_KEY, LOCALE_STORE_OPTIONS);
    if (isSupportedLocale(raw)) {
      cachedLocale = raw;
      return raw;
    }
  } catch {
    // SecureStore unavailable (e.g. web) — fall back to device/default resolution
  }
  return null;
}

export async function readStoredLocale(): Promise<LocaleCode> {
  const stored = await readStoredLocaleIfSet();
  return stored ?? 'en';
}

export async function persistLocale(locale: LocaleCode): Promise<void> {
  cachedLocale = locale;
  try {
    await SecureStore.setItemAsync(FLEXSHELL_LOCALE_STORAGE_KEY, locale, LOCALE_STORE_OPTIONS);
  } catch {
    // ignore when SecureStore is unavailable
  }
}

export function getCachedLocale(): LocaleCode {
  return cachedLocale ?? 'en';
}

export function resolveInitialLocale(deviceLocale?: string | null): LocaleCode {
  return normalizeLocaleTag(deviceLocale ?? 'en');
}

export async function setMobileLocale(code: LocaleCode): Promise<void> {
  await i18n.changeLanguage(code);
  await persistLocale(code);
}

export function activeMobileLocale(): LocaleCode {
  const lng = i18n.language?.split('-')[0]?.toLowerCase();
  if (lng === 'hi' || lng === 'kn' || lng === 'en') return lng;
  return 'en';
}
