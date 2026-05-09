<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LOCALE_CONFIG, SUPPORTED_LOCALES, isSupportedLocale, type LocaleCode } from '@saas-builder/i18n-contract';
import { setAppLocale } from '../../i18n';

const { t, locale } = useI18n();

const selectValue = computed(() => (isSupportedLocale(locale.value) ? locale.value : 'en'));

const options = computed(() =>
  SUPPORTED_LOCALES.map((code) => ({
    code,
    label: LOCALE_CONFIG[code].label,
    hint: LOCALE_CONFIG[code].englishLabel
  }))
);

async function onSelectChange(ev: Event) {
  const el = ev.target as HTMLSelectElement;
  const raw = el.value;
  if (isSupportedLocale(raw)) await setAppLocale(raw);
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
      <option v-for="o in options" :key="o.code" :value="o.code">{{ o.label }} ({{ o.hint }})</option>
    </select>
  </label>
</template>
