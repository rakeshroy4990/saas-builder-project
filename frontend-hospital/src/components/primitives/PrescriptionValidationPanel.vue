<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  getPrescriptionValidation,
  revalidatePrescription,
  reviewPrescriptionValidation,
  riskBadgeClass,
  type PrescriptionValidationResult
} from '../../services/http/patientPrescriptionValidationApi';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';

const props = defineProps<{
  prescriptionExternalId: string;
  doctorView?: boolean;
}>();

const { t } = useI18n();
const toastStore = useToastStore(pinia);
const loading = ref(false);
const actionLoading = ref(false);
const validation = ref<PrescriptionValidationResult | null>(null);

const isDoctorView = computed(() => props.doctorView !== false);

async function load(): Promise<void> {
  if (!props.prescriptionExternalId) return;
  loading.value = true;
  try {
    validation.value = await getPrescriptionValidation(props.prescriptionExternalId);
  } catch (ex) {
    validation.value = null;
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.prescriptionExternalId,
  () => {
    void load();
  },
  { immediate: true }
);

async function onRevalidate(): Promise<void> {
  actionLoading.value = true;
  try {
    validation.value = await revalidatePrescription(props.prescriptionExternalId);
    toastStore.show(t('prescriptionSafety.revalidated'), 'success');
  } catch (ex) {
    toastStore.show(ex instanceof Error ? ex.message : t('prescriptionSafety.revalidateFailed'), 'error');
  } finally {
    actionLoading.value = false;
  }
}

async function onReview(): Promise<void> {
  actionLoading.value = true;
  try {
    validation.value = await reviewPrescriptionValidation(props.prescriptionExternalId);
    toastStore.show(t('prescriptionSafety.reviewed'), 'success');
  } catch (ex) {
    toastStore.show(ex instanceof Error ? ex.message : t('prescriptionSafety.reviewFailed'), 'error');
  } finally {
    actionLoading.value = false;
  }
}

const showPatientNote = computed(() => {
  if (!validation.value || isDoctorView.value) return false;
  const level = validation.value.overallRiskLevel;
  return level === 'moderate' || level === 'high' || level === 'critical';
});

const flaggedDosages = computed(() =>
  (validation.value?.dosageFindings ?? []).filter((d) => d.status !== 'within_range')
);
</script>

<template>
  <section v-if="loading" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
    {{ t('prescriptionSafety.loading') }}
  </section>

  <section v-else-if="!validation" class="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
    {{ t('prescriptionSafety.noneYet') }}
  </section>

  <section
    v-else-if="showPatientNote"
    class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
  >
    <p v-if="validation.overallRiskLevel === 'critical'" class="font-medium">
      {{ t('prescriptionSafety.patientCritical') }}
    </p>
    <p v-else class="font-medium">{{ t('prescriptionSafety.patientRoutine') }}</p>
  </section>

  <section
    v-else-if="isDoctorView && validation.overallRiskLevel !== 'none'"
    class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    :class="{ 'ring-2 ring-rose-300': validation.overallRiskLevel === 'critical' && !validation.reviewedByDoctor }"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span
        class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset"
        :class="riskBadgeClass(validation.overallRiskLevel)"
      >
        {{ t(`prescriptionSafety.risk.${validation.overallRiskLevel}`) }}
      </span>
      <span v-if="validation.reviewedByDoctor" class="text-xs font-medium text-emerald-700">
        {{ t('prescriptionSafety.reviewedBadge') }}
      </span>
    </div>

    <p v-if="validation.llmSummary" class="text-sm text-slate-700">{{ validation.llmSummary }}</p>

    <div v-if="validation.interactionFindings.length" class="space-y-2">
      <h3 class="text-sm font-semibold text-slate-900">{{ t('prescriptionSafety.interactions') }}</h3>
      <article
        v-for="(item, idx) in validation.interactionFindings"
        :key="`${item.drugA}-${item.drugB}-${idx}`"
        class="rounded-lg border border-slate-200 p-3 text-sm"
      >
        <p class="font-semibold text-slate-900">{{ item.drugA }} + {{ item.drugB }}</p>
        <p class="mt-1 text-xs uppercase tracking-wide text-slate-500">{{ item.severity }}</p>
        <p class="mt-1 text-slate-700">{{ item.clinicalEffect }}</p>
        <p class="mt-1 text-slate-600">{{ item.management }}</p>
        <p v-if="item.drugsFrom === 'across_prescriptions'" class="mt-1 text-xs text-violet-700">
          {{ t('prescriptionSafety.acrossPrescriptions') }}
        </p>
      </article>
    </div>

    <div v-if="flaggedDosages.length" class="space-y-2">
      <h3 class="text-sm font-semibold text-slate-900">{{ t('prescriptionSafety.dosage') }}</h3>
      <article
        v-for="(item, idx) in flaggedDosages"
        :key="`${item.genericName}-${idx}`"
        class="rounded-lg border border-slate-200 p-3 text-sm"
      >
        <p class="font-semibold text-slate-900">{{ item.genericName }}</p>
        <p class="mt-1 text-slate-700">{{ item.message }}</p>
      </article>
    </div>

    <p v-if="validation.unrecognizedDrugs.length" class="text-sm text-slate-600">
      {{ t('prescriptionSafety.unrecognized', { drugs: validation.unrecognizedDrugs.join(', ') }) }}
    </p>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        :disabled="actionLoading"
        @click="onRevalidate"
      >
        {{ t('prescriptionSafety.recheck') }}
      </button>
      <button
        v-if="!validation.reviewedByDoctor"
        type="button"
        class="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
        :disabled="actionLoading"
        @click="onReview"
      >
        {{ t('prescriptionSafety.markReviewed') }}
      </button>
    </div>
  </section>
</template>
