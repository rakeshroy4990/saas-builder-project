import { watch } from 'vue';
import type { Composer, I18n } from 'vue-i18n';
import {
  FLEXSHELL_LOCALE_STORAGE_KEY,
  LOCALE_CONFIG,
  normalizeLocaleTag,
  type LocaleCode
} from '@saas-builder/i18n-contract';

function persistLocale(code: LocaleCode) {
  try {
    localStorage.setItem(FLEXSHELL_LOCALE_STORAGE_KEY, code);
  } catch {
    /* private mode / quota */
  }
}

/**
 * Syncs `<html lang dir>`, persists locale choice, and keeps `vue-i18n` on supported codes.
 */
export function bindDocumentLocaleAndStorage(i18n: I18n): void {
  const g = i18n.global as Composer;
  watch(
    () => g.locale.value,
    (raw) => {
      const code = normalizeLocaleTag(String(raw));
      if (String(raw) !== code) {
        g.locale.value = code;
        return;
      }
      persistLocale(code);
      const meta = LOCALE_CONFIG[code] ?? LOCALE_CONFIG.en;
      document.documentElement.lang = code;
      document.documentElement.dir = meta.dir;
    },
    { immediate: true }
  );
}
