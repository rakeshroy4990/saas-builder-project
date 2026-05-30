<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LOCALE_CONFIG, SUPPORTED_LOCALES, isSupportedLocale, type LocaleCode } from '@saas-builder/i18n-contract';
import { setAppLocale } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import { persistAuthSessionProfile } from '../../services/auth/authSessionStore';
import { apiClient } from '../../services/http/apiClient';
import { URLRegistry } from '../../services/http/URLRegistry';

const { t, locale } = useI18n();
const appStore = useAppStore(pinia);

const selectValue = computed(() => (isSupportedLocale(locale.value) ? locale.value : 'en'));

const options = computed(() =>
  SUPPORTED_LOCALES.map((code) => ({
    code,
    label: LOCALE_CONFIG[code].label
  }))
);

async function onSelectChange(ev: Event) {
  const el = ev.target as HTMLSelectElement;
  const raw = el.value.trim().toLowerCase();
  if (!isSupportedLocale(raw)) return;
  const next = raw as LocaleCode;
  await setAppLocale(next);
  appStore.setProperty('hospital', 'AuthSession', 'preferredLocale', next);
  appStore.setProperty('hospital', 'ProfileForm', 'preferredLocale', next);
  persistAuthSessionProfile({ preferredLocale: next });
  const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const userId = String(session.userId ?? '').trim();
  if (!userId) return;
  try {
    await apiClient.put(URLRegistry.paths.userProfile, { PreferredLocale: next }, { params: { userId } });
  } catch {
    // Non-fatal: keep local preference and retry later from profile/language changes.
  }
}
</script>

<template>
  <label class="inline-flex flex-col gap-0.5">
    <span class="sr-only">{{ t('nav.language') }}</span>
    <select
      data-testid="app-language-select"
      :value="selectValue"
      class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
      :aria-label="t('nav.languageHint')"
      @change="onSelectChange"
    >
      <option v-for="o in options" :key="o.code" :value="o.code">{{ o.label }}</option>
    </select>
  </label>
</template>
