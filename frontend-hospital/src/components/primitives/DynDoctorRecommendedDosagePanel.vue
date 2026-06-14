<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  recommendDoctorPediatricDosage,
  type RecommendedDosageResult
} from '../../services/http/doctorPrescriptionSafetyApi';
import { resolveUserFacingErrorMessage } from '../../services/http/httpUserFacingErrors';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';

const { t } = useI18n();
const toastStore = useToastStore(pinia);

const childAgeMonths = ref('');
const childWeightKg = ref('');
const drugName = ref('');
const recommending = ref(false);
const recommendation = ref<RecommendedDosageResult | null>(null);
const recommendError = ref('');

const parsedAgeMonths = computed(() => {
  const n = Number(childAgeMonths.value);
  return Number.isFinite(n) && n > 0 ? n : null;
});

const parsedWeightKg = computed(() => {
  const n = Number(childWeightKg.value);
  return Number.isFinite(n) && n > 0 ? n : null;
});

const canRecommend = computed(() => {
  if (recommending.value) return false;
  return Boolean(drugName.value.trim()) && parsedAgeMonths.value != null && parsedWeightKg.value != null;
});

async function submitRecommendation(): Promise<void> {
  if (!drugName.value.trim() || parsedAgeMonths.value == null || parsedWeightKg.value == null) {
    toastStore.show(t('dashboard.recommendedDosage.needsAllFields'), 'error');
    return;
  }
  recommending.value = true;
  recommendError.value = '';
  recommendation.value = null;
  try {
    recommendation.value = await recommendDoctorPediatricDosage({
      drugName: drugName.value,
      childAgeMonths: parsedAgeMonths.value,
      childWeightKg: parsedWeightKg.value
    });
    if (!recommendation.value) {
      recommendError.value = t('dashboard.recommendedDosage.failed');
    }
  } catch (err) {
    recommendError.value = resolveUserFacingErrorMessage(err, 'dashboard.recommendedDosage.failed');
  } finally {
    recommending.value = false;
  }
}

function formatRange(range: number[] | null | undefined): string {
  if (!range?.length) return '—';
  if (range.length === 1) return `${range[0]} mg`;
  return `${range[0]}–${range[1]} mg`;
}

function formatFrequency(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return `${min}–${max}×/day`;
  const n = min ?? max;
  return n == null ? '—' : `${n}×/day`;
}
</script>

<template>
  <section class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block space-y-1 text-sm">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {{ t('dashboard.recommendedDosage.childAgeMonths') }}
        </span>
        <input
          v-model="childAgeMonths"
          type="number"
          min="0"
          step="0.1"
          class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          :placeholder="t('dashboard.recommendedDosage.childAgePlaceholder')"
        />
      </label>
      <label class="block space-y-1 text-sm">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {{ t('dashboard.recommendedDosage.childWeightKg') }}
        </span>
        <input
          v-model="childWeightKg"
          type="number"
          min="0"
          step="0.01"
          class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          :placeholder="t('dashboard.recommendedDosage.childWeightPlaceholder')"
        />
      </label>
    </div>

    <label class="block space-y-1 text-sm">
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {{ t('dashboard.recommendedDosage.drugName') }}
      </span>
      <input
        v-model="drugName"
        type="text"
        class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
        :placeholder="t('dashboard.recommendedDosage.drugNamePlaceholder')"
      />
    </label>

    <button
      type="button"
      class="inline-flex items-center justify-center self-start rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      :disabled="!canRecommend"
      @click="submitRecommendation"
    >
      {{ recommending ? t('dashboard.recommendedDosage.loading') : t('dashboard.recommendedDosage.action') }}
    </button>

    <p v-if="recommendError" class="text-sm text-rose-700">{{ recommendError }}</p>

    <section
      v-if="recommendation"
      class="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
    >
      <p class="font-semibold text-slate-900">
        {{ recommendation.genericName || recommendation.extractedName }}
      </p>
      <p class="text-slate-700">{{ recommendation.message }}</p>

      <dl v-if="recommendation.status === 'available'" class="grid gap-2 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ t('dashboard.recommendedDosage.expectedDose') }}
          </dt>
          <dd class="mt-0.5 text-slate-900">{{ formatRange(recommendation.expectedDoseRangeMg) }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ t('dashboard.recommendedDosage.dosePerKg') }}
          </dt>
          <dd class="mt-0.5 text-slate-900">
            {{ recommendation.dosePerKgMg != null ? `${recommendation.dosePerKgMg} mg/kg` : '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ t('dashboard.recommendedDosage.maxDaily') }}
          </dt>
          <dd class="mt-0.5 text-slate-900">
            {{ recommendation.maxDailyDoseMg != null ? `${recommendation.maxDailyDoseMg} mg` : '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ t('dashboard.recommendedDosage.frequency') }}
          </dt>
          <dd class="mt-0.5 text-slate-900">
            {{ formatFrequency(recommendation.frequencyPerDayMin, recommendation.frequencyPerDayMax) }}
          </dd>
        </div>
      </dl>

      <p v-if="recommendation.source" class="text-xs text-slate-500">
        {{ t('dashboard.recommendedDosage.source', { source: recommendation.source }) }}
      </p>
    </section>
  </section>
</template>
