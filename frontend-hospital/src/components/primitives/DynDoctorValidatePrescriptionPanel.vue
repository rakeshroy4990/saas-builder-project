<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { riskBadgeClass, validateDoctorPrescriptionFromSummary } from '../../services/http/doctorPrescriptionSafetyApi';
import {
  postDoctorPrescriptionTranscribeUploadStream,
  type DoctorPrescriptionTranscribeResult
} from '../../services/http/doctorPrescriptionSafetyTranscribeUploadStream';
import type { PrescriptionValidationResult } from '../../services/http/patientPrescriptionValidationApi';
import { resolveUserFacingErrorMessage } from '../../services/http/httpUserFacingErrors';

const { t } = useI18n();

const pendingFile = ref<File | null>(null);
const transcribing = ref(false);
const validating = ref(false);
const validation = ref<PrescriptionValidationResult | null>(null);
const validationError = ref('');
const transcribeError = ref('');
const streamPhase = ref('');
const transcribeResult = ref<DoctorPrescriptionTranscribeResult | null>(null);
const prescriptionSummary = ref('');
const summaryEditing = ref(false);

const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const abortController = ref<AbortController | null>(null);

const phaseLabel = computed(() => {
  const phase = streamPhase.value.trim();
  if (!phase) return t('dashboard.validatePrescription.reading');
  const key = `dashboard.validatePrescription.phase.${phase}`;
  const translated = t(key);
  return translated === key ? t('dashboard.validatePrescription.reading') : translated;
});

const hasTranscribedSummary = computed(() => prescriptionSummary.value.trim().length > 0);

const extractedMedicines = computed(() => {
  const fromValidation = (validation.value?.dosageFindings ?? [])
    .map((d) => d.genericName.trim())
    .filter(Boolean);
  const fromTranscribe = (transcribeResult.value?.medicines ?? []).map((m) => m.trim()).filter(Boolean);
  const names = fromValidation.length ? fromValidation : fromTranscribe;
  return [...new Set(names)];
});

const flaggedDosages = computed(() =>
  (validation.value?.dosageFindings ?? []).filter((d) => d.status !== 'within_range')
);

const showValidationResults = computed(() => {
  if (!validation.value) return false;
  return validation.value.overallRiskLevel !== 'none'
    || validation.value.interactionFindings.length > 0
    || flaggedDosages.value.length > 0
    || validation.value.unrecognizedDrugs.length > 0
    || extractedMedicines.value.length > 0
    || Boolean(validation.value.llmSummary?.trim());
});

function openFilePicker(): void {
  fileInputRef.value?.click();
}

function openCameraPicker(): void {
  cameraInputRef.value?.click();
}

function onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;
  pendingFile.value = file;
  validation.value = null;
  validationError.value = '';
  transcribeError.value = '';
  transcribeResult.value = null;
  prescriptionSummary.value = '';
  summaryEditing.value = false;
  void runTranscription(file);
}

function clearPendingFile(): void {
  abortController.value?.abort();
  abortController.value = null;
  pendingFile.value = null;
  validation.value = null;
  validationError.value = '';
  transcribeError.value = '';
  streamPhase.value = '';
  transcribeResult.value = null;
  prescriptionSummary.value = '';
  summaryEditing.value = false;
  transcribing.value = false;
  validating.value = false;
}

function toggleSummaryEdit(): void {
  summaryEditing.value = !summaryEditing.value;
}

async function runTranscription(file: File): Promise<void> {
  abortController.value?.abort();
  const controller = new AbortController();
  abortController.value = controller;

  transcribing.value = true;
  transcribeError.value = '';
  validation.value = null;
  validationError.value = '';
  streamPhase.value = '';
  transcribeResult.value = null;
  prescriptionSummary.value = '';
  summaryEditing.value = false;

  try {
    const result = await postDoctorPrescriptionTranscribeUploadStream(
      file,
      {
        onStatus: (phase) => {
          streamPhase.value = phase;
        },
        onTranscribed: (preview) => {
          if (preview.summary) {
            prescriptionSummary.value = preview.summary;
          }
        },
        onComplete: (row) => {
          transcribeResult.value = row;
          prescriptionSummary.value = row.summary?.trim() || prescriptionSummary.value;
        }
      },
      controller.signal
    );
    if (!result?.summary?.trim()) {
      transcribeError.value = t('dashboard.validatePrescription.transcribeFailed');
    }
  } catch (err) {
    if (controller.signal.aborted) return;
    transcribeError.value = resolveUserFacingErrorMessage(err, 'dashboard.validatePrescription.transcribeFailed');
  } finally {
    if (abortController.value === controller) {
      transcribing.value = false;
      streamPhase.value = '';
      abortController.value = null;
    }
  }
}

async function runValidation(): Promise<void> {
  if (!prescriptionSummary.value.trim()) {
    validationError.value = t('dashboard.validatePrescription.summaryRequired');
    return;
  }
  validating.value = true;
  validationError.value = '';
  validation.value = null;
  try {
    validation.value = await validateDoctorPrescriptionFromSummary({
      prescriptionSummary: prescriptionSummary.value,
      childWeightKg: transcribeResult.value?.childWeightKg ?? null,
      childAgeMonths: transcribeResult.value?.childAgeMonths ?? null,
      temperatureF: transcribeResult.value?.temperatureF ?? null,
      weightSource: transcribeResult.value?.weightSource
    });
    if (!validation.value) {
      validationError.value = t('dashboard.validatePrescription.failed');
    }
  } catch (err) {
    validationError.value = resolveUserFacingErrorMessage(err, 'dashboard.validatePrescription.failed');
  } finally {
    validating.value = false;
  }
}
</script>

<template>
  <section class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center gap-2">
      <input
        ref="fileInputRef"
        type="file"
        class="sr-only"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        @change="onFileSelected"
      />
      <input
        ref="cameraInputRef"
        type="file"
        class="sr-only"
        accept="image/*"
        capture="environment"
        @change="onFileSelected"
      />
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50"
        :disabled="transcribing || validating"
        @click="openFilePicker"
      >
        {{ t('dashboard.validatePrescription.attachFile') }}
      </button>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50"
        :disabled="transcribing || validating"
        @click="openCameraPicker"
      >
        {{ t('dashboard.validatePrescription.attachCamera') }}
      </button>
    </div>

    <p v-if="pendingFile" class="text-xs text-slate-600">
      <span class="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium">
        {{ t('dashboard.validatePrescription.attachedFile', { name: pendingFile.name }) }}
      </span>
      <button type="button" class="ml-2 font-semibold text-sky-700 hover:underline" @click="clearPendingFile">
        {{ t('dashboard.validatePrescription.removeFile') }}
      </button>
    </p>

    <p v-if="transcribeError" class="text-sm text-rose-700">{{ transcribeError }}</p>
    <p v-if="validationError" class="text-sm text-rose-700">{{ validationError }}</p>

    <section v-if="transcribing" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <p>{{ phaseLabel }}</p>
    </section>

    <section
      v-else-if="hasTranscribedSummary"
      class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-slate-900">{{ t('dashboard.validatePrescription.summaryTitle') }}</h3>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-800"
          :aria-label="t('dashboard.validatePrescription.editSummary')"
          @click="toggleSummaryEdit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4" aria-hidden="true">
            <path d="m2.695 14.763-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
          </svg>
          {{ summaryEditing ? t('dashboard.validatePrescription.doneEditing') : t('dashboard.validatePrescription.editSummary') }}
        </button>
      </div>

      <textarea
        v-if="summaryEditing"
        v-model="prescriptionSummary"
        rows="12"
        class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-800 shadow-inner focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
      />
      <pre
        v-else
        class="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
      >{{ prescriptionSummary }}</pre>

      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:opacity-50"
        :disabled="validating || transcribing"
        @click="runValidation"
      >
        {{ validating ? t('dashboard.validatePrescription.validating') : t('dashboard.validatePrescription.action') }}
      </button>
    </section>

    <section
      v-if="validation && showValidationResults"
      class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <span
        class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset"
        :class="riskBadgeClass(validation.overallRiskLevel)"
      >
        {{ t(`prescriptionSafety.risk.${validation.overallRiskLevel}`) }}
      </span>

      <div v-if="extractedMedicines.length" class="space-y-1">
        <h3 class="text-sm font-semibold text-slate-900">{{ t('dashboard.validatePrescription.medicinesFound') }}</h3>
        <p class="text-sm text-slate-700">{{ extractedMedicines.join(', ') }}</p>
      </div>

      <div
        v-if="validation && (validation.childWeightKgUsed != null || validation.temperatureFUsed != null || validation.childAgeMonthsUsed != null)"
        class="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900"
      >
        <p class="font-semibold">{{ t('dashboard.validatePrescription.vitalsFound') }}</p>
        <p v-if="validation.childWeightKgUsed != null">
          {{ t('dashboard.validatePrescription.weightLabel', { value: validation.childWeightKgUsed }) }}
        </p>
        <p v-if="validation.temperatureFUsed != null">
          {{ t('dashboard.validatePrescription.temperatureLabel', { value: validation.temperatureFUsed }) }}
        </p>
        <p v-if="validation.childAgeMonthsUsed != null">
          {{ t('dashboard.validatePrescription.ageLabel', { value: validation.childAgeMonthsUsed }) }}
        </p>
      </div>

      <p v-if="validation && validation.childWeightKgUsed == null && validation.weightSource === 'not_available'" class="text-xs text-amber-800">
        {{ t('dashboard.validatePrescription.noWeightHint') }}
      </p>

      <p v-if="validation.llmSummary" class="text-sm text-slate-700">{{ validation.llmSummary }}</p>

      <div v-if="validation.interactionFindings.length" class="space-y-2">
        <h3 class="text-sm font-semibold text-slate-900">{{ t('prescriptionSafety.interactions') }}</h3>
        <article
          v-for="(item, idx) in validation.interactionFindings"
          :key="`${item.drugA}-${item.drugB}-${idx}`"
          class="rounded-lg border border-slate-200 bg-white p-3 text-sm"
        >
          <p class="font-semibold text-slate-900">{{ item.drugA }} + {{ item.drugB }}</p>
          <p class="mt-1 text-xs uppercase tracking-wide text-slate-500">{{ item.severity }}</p>
          <p class="mt-1 text-slate-700">{{ item.clinicalEffect }}</p>
        </article>
      </div>

      <div v-if="validation.dosageFindings.length" class="space-y-2">
        <h3 class="text-sm font-semibold text-slate-900">{{ t('prescriptionSafety.dosage') }}</h3>
        <article
          v-for="(item, idx) in validation.dosageFindings"
          :key="`${item.genericName}-${idx}`"
          class="rounded-lg border border-slate-200 bg-white p-3 text-sm"
        >
          <p class="font-semibold text-slate-900">{{ item.genericName }}</p>
          <p class="mt-1 text-slate-700">{{ item.message }}</p>
        </article>
      </div>

      <p v-if="validation.unrecognizedDrugs.length" class="text-sm text-slate-600">
        {{ t('prescriptionSafety.unrecognized', { drugs: validation.unrecognizedDrugs.join(', ') }) }}
      </p>
    </section>

    <section
      v-else-if="validation"
      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      {{ t(`prescriptionSafety.risk.${validation.overallRiskLevel}`) }}
    </section>
  </section>
</template>
