<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import { useActionEngine } from '../../composables/useActionEngine';
import { hospitalPages } from '../../configs/hospital/pages';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ChildProfileRow } from '../../services/http/growthApi';

const appStore = useAppStore(pinia);
const popupPage = hospitalPages.find((page) => page.pageId === 'appointment-growth-popup') ?? hospitalPages[0]!;
const engine = useActionEngine(popupPage);
const { t } = useI18n();

const primaryButtonClass = resolveStyle({ styleTemplate: 'hosp.popup.button.primary' });
const ws = (token: string): string => resolveStyle({ styleTemplate: `hosp.workspace.${token}` });

const session = computed(() => {
  void appStore.dataRevision;
  const raw = (appStore.getData('hospital', 'AppointmentGrowthSession') ?? {}) as Record<string, unknown>;
  return {
    loading: Boolean(raw.loading),
    patientName: String(raw.patientName ?? ''),
    children: Array.isArray(raw.children) ? (raw.children as ChildProfileRow[]) : [],
    selectedChildId: String(raw.selectedChildId ?? ''),
    entryHeightCm: String(raw.entryHeightCm ?? ''),
    entryWeightKg: String(raw.entryWeightKg ?? ''),
    entryHcCm: String(raw.entryHcCm ?? ''),
    lastSavedSummary: String(raw.lastSavedSummary ?? '')
  };
});

async function run(actionId: string, data: Record<string, unknown> = {}): Promise<void> {
  await engine.execute({ actionId, data });
}

function onField(field: string, event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  void run('patch-appointment-growth-session', { [field]: value });
}
</script>

<template>
  <div :class="ws('stack')">
    <p v-if="session.patientName" :class="ws('pageIntro')">
      {{ t('growth.appointment.patientLabel', { name: session.patientName }) }}
    </p>

    <label :class="ws('fieldLabel')">
      {{ t('growth.selectChild') }}
      <select
        :class="ws('input')"
        :value="session.selectedChildId"
        :disabled="session.loading"
        @change="run('patch-appointment-growth-session', { childId: ($event.target as HTMLSelectElement).value })"
      >
        <option value="" disabled>{{ t('growth.selectChildPlaceholder') }}</option>
        <option v-for="child in session.children" :key="child.externalId" :value="child.externalId">
          {{ child.displayName }}
        </option>
      </select>
    </label>

    <p v-if="!session.loading && session.children.length === 0" class="text-sm text-amber-800">
      {{ t('growth.appointment.noChildren') }}
    </p>

    <div :class="ws('formGrid')">
      <label class="flex flex-col gap-1 text-sm text-slate-800">
        {{ t('growth.heightCm') }}
        <input
          type="number"
          step="0.1"
          :class="ws('input')"
          :value="session.entryHeightCm"
          :disabled="session.loading"
          @input="onField('entryHeightCm', $event)"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-slate-800">
        {{ t('growth.weightKg') }}
        <input
          type="number"
          step="0.01"
          :class="ws('input')"
          :value="session.entryWeightKg"
          :disabled="session.loading"
          @input="onField('entryWeightKg', $event)"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-slate-800">
        {{ t('growth.headCircCm') }}
        <input
          type="number"
          step="0.1"
          :class="ws('input')"
          :value="session.entryHcCm"
          :disabled="session.loading"
          @input="onField('entryHcCm', $event)"
        />
      </label>
    </div>

    <p v-if="session.lastSavedSummary" class="text-sm font-medium text-emerald-800">
      {{ session.lastSavedSummary }}
    </p>

    <div class="flex flex-wrap gap-3">
      <button
        type="button"
        :class="primaryButtonClass"
        :disabled="session.loading || !session.selectedChildId"
        @click="run('save-appointment-growth-reading')"
      >
        {{ session.loading ? t('growth.loading') : t('growth.appointment.saveForVisit') }}
      </button>
    </div>
  </div>
</template>
