import { createI18n } from 'vue-i18n';
import type { Composer, I18n } from 'vue-i18n';
import { bindDocumentLocaleAndStorage } from './documentLocale';
import { readInitialLocale } from './initialLocale';
import { loadLocaleMessages } from './loadLocaleMessages';
import { isSupportedLocale, type LocaleCode } from '@saas-builder/i18n-contract';
import { useAppStore } from '../store/useAppStore';
import { pinia } from '../store/pinia';
import { refreshHospitalLocalizedUi } from '../services/domain/hospital/i18n/refreshLocalizedUi';
import { reloadMedicalDepartmentOptionsForActiveLocale } from '../services/domain/hospital/shared/medicalDepartments';
import { reloadHomeDoctorsForActiveLocale } from '../services/domain/hospital/home/loadDoctorsService';
import { refreshHospitalLocalizedChatWelcome } from '../services/domain/hospital/chat/localizedChatWelcome';
import { applyCachedServerI18nBundles, attachServerI18nBundles } from './serverI18nBundles';

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

attachServerI18nBundles(i18n);

let documentBindingDone = false;

/** Call once before `app.mount` so first paint has messages + html attrs. */
export async function initI18n(): Promise<void> {
  await loadLocaleMessages(i18n, 'en');
  await loadLocaleMessages(i18n, initial);
  applyCachedServerI18nBundles();
  if (!documentBindingDone) {
    bindDocumentLocaleAndStorage(i18n);
    documentBindingDone = true;
  }
}

export async function setAppLocale(next: LocaleCode): Promise<void> {
  await loadLocaleMessages(i18n, next);
  applyCachedServerI18nBundles();
  const composer = i18n.global as Composer;
  composer.locale.value = next;
  await reloadMedicalDepartmentOptionsForActiveLocale();
  await reloadHomeDoctorsForActiveLocale();
  refreshHospitalLocalizedUi(composer);
  refreshHospitalLocalizedChatWelcome(composer);
}

/** After session hydrate: align vue-i18n with persisted profile `preferredLocale` when supported. */
export async function applyPreferredLocaleFromAuthSession(): Promise<void> {
  const appStore = useAppStore(pinia);
  const sess = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const pl = String(sess.preferredLocale ?? '').trim().toLowerCase();
  if (isSupportedLocale(pl)) {
    await setAppLocale(pl);
  }
}
