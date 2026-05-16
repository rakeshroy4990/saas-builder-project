<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  postPatientPrescriptionSimilaritySearch,
  type PatientPrescriptionSimilarityHit
} from '../../services/http/patientPrescriptionSimilarityApi';
import { getPatientPrescriptionDownloadUrl } from '../../services/http/patientPrescriptionApi';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';

const { t } = useI18n();
const toastStore = useToastStore(pinia);
const draft = ref('');
const searching = ref(false);
const readingFile = ref(false);
const error = ref('');
const emptyHint = ref('');
const results = ref<PatientPrescriptionSimilarityHit[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const pendingFile = ref<File | null>(null);
const viewingExternalId = ref('');

const quickFills = computed(() => [
  {
    id: 'diabetes',
    label: t('education.prescriptionSimilarity.quickFill.diabetes'),
    text: t('education.prescriptionSimilarity.quickFill.diabetesText')
  },
  {
    id: 'hypertension',
    label: t('education.prescriptionSimilarity.quickFill.hypertension'),
    text: t('education.prescriptionSimilarity.quickFill.hypertensionText')
  },
  {
    id: 'pediatricFever',
    label: t('education.prescriptionSimilarity.quickFill.pediatricFever'),
    text: t('education.prescriptionSimilarity.quickFill.pediatricFeverText')
  }
]);

const canSearch = computed(() => {
  if (searching.value || readingFile.value) return false;
  return Boolean(draft.value.trim() || pendingFile.value);
});

function formatPercent(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function hasDisplayDetails(hit: PatientPrescriptionSimilarityHit): boolean {
  const d = hit.details;
  if (!d) return Boolean(hit.searchText?.trim());
  return Boolean(
    d.diagnosis?.trim() ||
      (d.medicines?.length ?? 0) > 0 ||
      (d.dosage?.length ?? 0) > 0 ||
      (d.advice?.length ?? 0) > 0 ||
      d.notes?.trim()
  );
}

function onDraftInput(event: Event) {
  draft.value = (event.target as HTMLTextAreaElement).value;
  error.value = '';
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function openCameraPicker() {
  cameraInputRef.value?.click();
}

async function applyQuickFill(text: string) {
  draft.value = text;
  pendingFile.value = null;
  error.value = '';
  emptyHint.value = '';
  await runSearch();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  pendingFile.value = file;
  error.value = '';
  readingFile.value = true;
  try {
    await runSearch({ file });
  } catch (err) {
    error.value =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : t('education.prescriptionSimilarity.searchFailed');
  } finally {
    readingFile.value = false;
  }
}

async function runSearch(opts?: { file?: File }) {
  const file = opts?.file ?? pendingFile.value ?? undefined;
  const query = draft.value.trim();
  if (!file && !query) {
    error.value = t('education.prescriptionSimilarity.emptyQuery');
    return;
  }
  searching.value = true;
  error.value = '';
  emptyHint.value = '';
  try {
    const hits = await postPatientPrescriptionSimilaritySearch({
      query: query || undefined,
      file,
      limit: 10
    });
    results.value = hits;
    if (!hits.length) {
      emptyHint.value = t('education.prescriptionSimilarity.noResults');
    }
  } catch (err) {
    results.value = [];
    emptyHint.value = '';
    error.value =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : t('education.prescriptionSimilarity.searchFailed');
  } finally {
    searching.value = false;
  }
}

async function submitSearch() {
  await runSearch();
}

function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  if (!canSearch.value) return;
  void submitSearch();
}

function clearPendingFile() {
  pendingFile.value = null;
}

async function viewPrescription(hit: PatientPrescriptionSimilarityHit): Promise<void> {
  const externalId = String(hit.externalId ?? '').trim();
  if (!externalId || viewingExternalId.value) return;
  viewingExternalId.value = externalId;
  try {
    const { signedUrl } = await getPatientPrescriptionDownloadUrl(externalId);
    if (!signedUrl) {
      toastStore.show(t('education.prescriptionSimilarity.viewFailed'), 'error');
      return;
    }
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
  } catch {
    toastStore.show(t('education.prescriptionSimilarity.viewFailed'), 'error');
  } finally {
    viewingExternalId.value = '';
  }
}

function isViewing(hit: PatientPrescriptionSimilarityHit): boolean {
  return viewingExternalId.value === String(hit.externalId ?? '').trim();
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <p class="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900">
      {{ t('education.prescriptionSimilarity.banner') }}
    </p>

    <div class="space-y-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {{ t('education.prescriptionSimilarity.quickFillTitle') }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="example in quickFills"
          :key="example.id"
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="searching || readingFile"
          @click="applyQuickFill(example.text)"
        >
          {{ example.label }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2 min-w-0">
        <label for="doctor-education-prescription-similarity-draft" class="text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-0">
          {{ t('education.prescriptionSimilarity.inputLabel') }}
        </label>
        <div class="flex shrink-0 items-center gap-1">
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
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="searching || readingFile"
            :aria-label="t('education.conversation.attachFileAria')"
            @click="openFilePicker"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.64 16.78a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="searching || readingFile"
            :aria-label="t('education.conversation.attachCameraAria')"
            @click="openCameraPicker"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 7a2 2 0 012-2h2.5L10 4h4l1.5 1H18a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
          </button>
        </div>
      </div>

      <p v-if="pendingFile" class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span class="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium">
          {{ t('education.prescriptionSimilarity.attachedFile', { name: pendingFile.name }) }}
        </span>
        <button type="button" class="font-semibold text-sky-700 hover:underline" @click="clearPendingFile">
          {{ t('education.prescriptionSimilarity.removeFile') }}
        </button>
      </p>

      <textarea
        id="doctor-education-prescription-similarity-draft"
        :value="draft"
        rows="8"
        class="w-full min-h-[min(32vh,14rem)] max-h-[min(48vh,24rem)] resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
        :disabled="searching || readingFile"
        :placeholder="t('education.prescriptionSimilarity.inputPlaceholder')"
        @input="onDraftInput"
        @keydown="onComposerKeydown"
      />
    </div>

    <p v-if="error" class="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
      {{ error }}
    </p>
    <p v-else-if="emptyHint" class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
      {{ emptyHint }}
    </p>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs leading-5 text-slate-500">
        <span v-if="readingFile" class="font-medium text-sky-700">{{ t('education.conversation.readingPrescription') }}</span>
        <span v-else>{{ t('education.prescriptionSimilarity.submitHint') }}</span>
      </p>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        :disabled="!canSearch"
        @click="submitSearch"
      >
        {{ searching ? t('education.prescriptionSimilarity.searching') : t('education.prescriptionSimilarity.search') }}
      </button>
    </div>

    <div v-if="results.length" class="min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-slate-200 pt-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {{ t('education.prescriptionSimilarity.resultsTitle') }}
      </p>
      <article
        v-for="(hit, index) in results"
        :key="hit.externalId || String(index)"
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-1">
            <p class="text-sm font-semibold text-slate-900">
              {{ hit.patientName || t('education.prescriptionSimilarity.unknownPatient') }}
            </p>
            <p class="text-xs text-slate-500">
              <span v-if="hit.doctorName">{{ hit.doctorName }}</span>
              <span v-if="hit.doctorName && hit.department"> · </span>
              <span v-if="hit.department">{{ hit.department }}</span>
              <span v-if="hit.gender"> · {{ hit.gender }}</span>
              <span v-if="hit.createdAt"> · {{ formatDate(hit.createdAt) }}</span>
            </p>
          </div>
          <span
            class="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold tabular-nums text-emerald-800"
            :title="t('education.prescriptionSimilarity.matchLabel')"
          >
            {{ formatPercent(hit.matchPercent) }}
          </span>
        </div>
        <div v-if="hasDisplayDetails(hit)" class="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
          <div v-if="hit.details?.diagnosis?.trim()" class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {{ t('education.prescriptionSimilarity.fields.diagnosis') }}
            </p>
            <p class="text-sm leading-6 text-slate-800">{{ hit.details.diagnosis }}</p>
          </div>
          <div v-if="hit.details?.medicines?.length" class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {{ t('education.prescriptionSimilarity.fields.medicines') }}
            </p>
            <ul class="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-800">
              <li v-for="(medicine, medIndex) in hit.details.medicines" :key="`${hit.externalId}-med-${medIndex}`">
                {{ medicine }}
              </li>
            </ul>
          </div>
          <div v-if="hit.details?.dosage?.length" class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {{ t('education.prescriptionSimilarity.fields.dosage') }}
            </p>
            <ul class="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-800">
              <li v-for="(line, doseIndex) in hit.details.dosage" :key="`${hit.externalId}-dose-${doseIndex}`">
                {{ line }}
              </li>
            </ul>
          </div>
          <div v-if="hit.details?.advice?.length" class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {{ t('education.prescriptionSimilarity.fields.advice') }}
            </p>
            <ul class="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-800">
              <li v-for="(line, adviceIndex) in hit.details.advice" :key="`${hit.externalId}-advice-${adviceIndex}`">
                {{ line }}
              </li>
            </ul>
          </div>
          <div v-if="hit.details?.notes?.trim()" class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {{ t('education.prescriptionSimilarity.fields.notes') }}
            </p>
            <p class="text-sm leading-6 text-slate-800 whitespace-pre-wrap">{{ hit.details.notes }}</p>
          </div>
        </div>
        <p v-else class="mt-3 text-sm text-slate-500 italic">
          {{ t('education.prescriptionSimilarity.noSnippet') }}
        </p>
        <div class="mt-4 flex flex-wrap justify-end">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!hit.externalId || Boolean(viewingExternalId)"
            @click="viewPrescription(hit)"
          >
            {{ isViewing(hit) ? t('education.prescriptionSimilarity.viewingPrescription') : t('education.prescriptionSimilarity.viewPrescription') }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>
