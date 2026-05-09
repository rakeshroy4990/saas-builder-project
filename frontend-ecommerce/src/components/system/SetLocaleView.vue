<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { isSupportedLocale } from '@saas-builder/i18n-contract';
import { setAppLocale } from '../../i18n';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

onMounted(async () => {
  const raw = String(route.params.code ?? '').trim().toLowerCase();
  if (isSupportedLocale(raw)) {
    await setAppLocale(raw);
  }
  const defaultPackageName =
    import.meta.env.VITE_DEFAULT_PACKAGE_NAME ?? import.meta.env.VITE_DEFAULT_NAMESPACE ?? 'ecommerce';
  const defaultPageId = import.meta.env.VITE_DEFAULT_PAGE_ID ?? 'home';
  await router.replace(`/page/${defaultPackageName}/${defaultPageId}`);
});
</script>

<template>
  <div class="p-6 text-center text-sm text-slate-600" role="status">{{ t('locale.setTitle') }}</div>
</template>
