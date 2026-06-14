import { isSupportedLocale, type LocaleCode } from '@saas-builder/i18n-contract';
import type { Composer } from 'vue-i18n';

import { useAppStore } from '../store/useAppStore';
import { pinia } from '../store/pinia';
import { i18n } from './index';

function pickActiveLocale(...candidates: Array<string | null | undefined>): LocaleCode {
  for (const candidate of candidates) {
    if (candidate == null || String(candidate).trim() === '') continue;
    const primary = String(candidate).trim().split(/[-_]/)[0]?.toLowerCase();
    if (primary && isSupportedLocale(primary)) return primary;
  }
  return 'en';
}

/** App-wide locale — matches visible UI (vue-i18n), then profile preference. */
export function activeAppLocale(): LocaleCode {
  const composer = i18n.global as Composer;
  const appStore = useAppStore(pinia);
  const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  return pickActiveLocale(
    String(composer.locale.value ?? ''),
    String(session.preferredLocale ?? '')
  );
}
