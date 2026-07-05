<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import {
  SMART_WATCH_PLATFORMS,
  clearSmartWatchIntegration,
  readSmartWatchIntegration,
  type SmartWatchPlatform
} from '../../services/domain/hospital/devices/smartWatchIntegration';

defineProps<{
  htmlId?: string;
}>();

const { t } = useI18n({ useScope: 'global' });
const toastStore = useToastStore(pinia);

const PLATFORM_ICONS: Record<SmartWatchPlatform, string> = {
  apple_watch: '⌚',
  wear_os: '⌚',
  samsung_galaxy: '⌚',
  fitbit: '⌚',
  fire_boltt: '⌚'
};

const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=com.agastya.healthcare';

const selectedPlatform = ref<SmartWatchPlatform | null>(null);
const savedPlatform = ref<SmartWatchPlatform | null>(null);

const activePlatform = computed(() => selectedPlatform.value ?? savedPlatform.value);

const showPlatformList = computed(() => activePlatform.value === null);

function platformLabel(platform: SmartWatchPlatform): string {
  return t(`devices.smartWatch.platforms.${platform}.label`);
}

function platformSteps(platform: SmartWatchPlatform): string[] {
  const steps = t(`devices.smartWatch.platforms.${platform}.steps`, { returnObjects: true });
  return Array.isArray(steps) ? steps.map(String) : [];
}

function syncItems(): string[] {
  const items = t('devices.smartWatch.syncItems', { returnObjects: true });
  return Array.isArray(items) ? items.map(String) : [];
}

function loadState(): void {
  const saved = readSmartWatchIntegration();
  savedPlatform.value = saved.platform;
  if (saved.platform) selectedPlatform.value = saved.platform;
}

function selectPlatform(platform: SmartWatchPlatform): void {
  selectedPlatform.value = platform;
}

function onChangeWatchType(): void {
  selectedPlatform.value = null;
  savedPlatform.value = null;
  clearSmartWatchIntegration();
}

function onClearClick(): void {
  onChangeWatchType();
  toastStore.show(t('devices.smartWatch.clearedToast'), 'success');
}

function openMobileAppStore(): void {
  if (typeof window === 'undefined') return;
  window.open(ANDROID_APP_URL, '_blank', 'noopener,noreferrer');
}

onMounted(loadState);
</script>

<template>
  <div
    :id="htmlId"
    class="w-full border-t border-slate-200 pt-6 mt-2 space-y-4"
    data-testid="smart-watch-integration"
  >
    <div class="space-y-1">
      <h2 class="text-xl font-semibold text-slate-900">{{ t('devices.smartWatch.title') }}</h2>
      <p class="text-sm text-slate-600">{{ t('devices.smartWatch.intro') }}</p>
    </div>

    <div
      class="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950 space-y-2"
      role="note"
      data-testid="smart-watch-web-banner"
    >
      <p class="font-semibold">{{ t('devices.smartWatch.webOnlyTitle') }}</p>
      <p>{{ t('devices.smartWatch.webOnlyBody') }}</p>
    </div>

    <div v-if="showPlatformList" class="space-y-3">
      <p class="text-sm text-slate-600">{{ t('devices.smartWatch.choosePlatformHint') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          v-for="platform in SMART_WATCH_PLATFORMS"
          :key="platform"
          type="button"
          class="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
          :data-testid="`smart-watch-platform-${platform}`"
          @click="selectPlatform(platform)"
        >
          <span class="text-2xl mr-2" aria-hidden="true">{{ PLATFORM_ICONS[platform] }}</span>
          <span class="font-semibold text-slate-900">{{ platformLabel(platform) }}</span>
        </button>
      </div>
    </div>

    <div v-else class="space-y-4">
      <button
        type="button"
        class="text-sm text-emerald-700 hover:underline"
        @click="onChangeWatchType"
      >
        {{ t('devices.smartWatch.changeWatchType') }}
      </button>

      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <p class="font-semibold text-slate-900">
          <span aria-hidden="true">⌚</span>
          {{ platformLabel(activePlatform!) }}
        </p>
        <p class="text-sm text-slate-700">{{ t('devices.smartWatch.setupIntro') }}</p>
        <ol class="list-decimal list-inside space-y-1 text-sm text-slate-700">
          <li v-for="(step, index) in platformSteps(activePlatform!)" :key="index">
            {{ step }}
          </li>
        </ol>
      </div>

      <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
        <p class="text-sm font-semibold text-emerald-900">{{ t('devices.smartWatch.syncTitle') }}</p>
        <ul class="list-disc list-inside text-sm text-emerald-900/90 space-y-0.5">
          <li v-for="(item, index) in syncItems()" :key="index">{{ item }}</li>
        </ul>
      </div>

      <div class="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
        <p class="text-sm font-semibold text-amber-950">{{ t('devices.smartWatch.webConnectTitle') }}</p>
        <p class="text-sm text-amber-900">{{ t('devices.smartWatch.webConnectSteps') }}</p>
        <ol class="list-decimal list-inside space-y-1 text-sm text-amber-900">
          <li>{{ t('devices.smartWatch.webConnectStep1') }}</li>
          <li>{{ t('devices.smartWatch.webConnectStep2') }}</li>
          <li>{{ t('devices.smartWatch.webConnectStep3') }}</li>
        </ol>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          data-testid="smart-watch-open-mobile"
          @click="openMobileAppStore"
        >
          {{ t('devices.smartWatch.openMobileApp') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          data-testid="smart-watch-clear"
          @click="onClearClick"
        >
          {{ t('devices.smartWatch.clearSaved') }}
        </button>
      </div>
    </div>
  </div>
</template>
