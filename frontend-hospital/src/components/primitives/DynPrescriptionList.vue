<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import { useToastStore } from '../../store/useToastStore';
import type { PatientPrescriptionListItem } from '../../services/http/patientPrescriptionApi';
import { getPatientPrescriptionDownloadUrl } from '../../services/http/patientPrescriptionApi';

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { t } = useI18n();
const { execute } = useActionEngine(props.pageConfig);
const appStore = useAppStore(pinia);
const toastStore = useToastStore(pinia);

const state = computed(() => {
  return (appStore.getData('hospital', 'PatientPrescriptions') ?? {}) as {
    loading?: boolean;
    error?: string;
    items?: PatientPrescriptionListItem[];
  };
});

const items = computed(() => (Array.isArray(state.value.items) ? state.value.items : []));
const loading = computed(() => Boolean(state.value.loading));
const error = computed(() => String(state.value.error ?? '').trim());

async function refresh(): Promise<void> {
  await execute({ actionId: 'load-patient-prescriptions' });
}

onMounted(() => {
  void refresh();
});

watch(
  () => (appStore.getData('hospital', 'PrescriptionNav') as { activeItem?: string } | undefined)?.activeItem,
  (tab) => {
    if (tab === 'view') void refresh();
  }
);

function formatDate(iso: string): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

function statusLabel(status: string): string {
  const key = `prescriptions.view.status.${status}` as const;
  const translated = t(key);
  return translated === key ? status : translated;
}

function mimeLabel(mime: string): string {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return mime.replace('image/', '').toUpperCase();
  return mime || '—';
}

async function downloadItem(item: PatientPrescriptionListItem): Promise<void> {
  if (!item.externalId) return;
  try {
    const { signedUrl } = await getPatientPrescriptionDownloadUrl(item.externalId);
    if (!signedUrl) {
      toastStore.show(t('prescriptions.view.loadFailed'), 'error');
      return;
    }
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
  } catch {
    toastStore.show(t('prescriptions.view.loadFailed'), 'error');
  }
}

function summaryLines(item: PatientPrescriptionListItem): string[] {
  const ex = item.extractedData;
  const lines: string[] = [];
  const patientName = item.patientName ?? ex?.patientName;
  const gender = item.gender ?? ex?.patientGender;
  const department = item.department ?? ex?.department;
  const doctorName = item.doctorName ?? ex?.doctorName ?? ex?.consultant;
  if (patientName) lines.push(`Patient: ${patientName}`);
  if (ex?.ageGender) lines.push(`Age/Gender: ${ex.ageGender}`);
  else {
    if (ex?.patientAge) lines.push(`Age: ${ex.patientAge}`);
    if (gender) lines.push(`Gender: ${gender}`);
  }
  if (department) lines.push(`Department: ${department}`);
  if (ex?.registrationNumber) lines.push(`Reg. No.: ${ex.registrationNumber}`);
  if (ex?.appointmentDate || ex?.prescriptionDate) {
    lines.push(`Date: ${ex.appointmentDate ?? ex.prescriptionDate}`);
  }
  if (doctorName) lines.push(`Doctor: ${doctorName}`);
  if (!ex) return lines;
  if (ex.mobileNumber) lines.push(`Mobile: ${ex.mobileNumber}`);
  if (ex.diagnosis) lines.push(`Diagnosis: ${ex.diagnosis}`);
  if (ex.medicines?.length) {
    ex.medicines.forEach((m) => lines.push(`Rx: ${m}`));
  }
  if (ex.advice?.length) {
    ex.advice.forEach((a) => lines.push(`Advice: ${a}`));
  }
  if (ex.dosage?.length) lines.push(`Dosage: ${ex.dosage.join(' · ')}`);
  if (ex.notes) lines.push(`Notes: ${ex.notes}`);
  return lines;
}
</script>

<template>
  <section :id="htmlId" class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-slate-900">{{ t('prescriptions.view.title') }}</h2>
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        :disabled="loading"
        @click="refresh"
      >
        {{ t('prescriptions.view.refresh') }}
      </button>
    </div>

    <p v-if="loading" class="text-sm text-sky-700">Loading…</p>
    <p v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ error }}
    </p>
    <p v-else-if="!items.length" class="text-sm text-slate-500">{{ t('prescriptions.view.empty') }}</p>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-slate-600">{{ t('prescriptions.view.columns.date') }}</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-600">{{ t('prescriptions.view.columns.status') }}</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-600">{{ t('prescriptions.view.columns.type') }}</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-600">{{ t('prescriptions.view.columns.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          <tr v-for="item in items" :key="item.externalId">
            <td class="px-3 py-2 text-slate-800">{{ formatDate(item.createdAt) }}</td>
            <td class="px-3 py-2">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="{
                  'bg-slate-100 text-slate-700': item.status === 'pending',
                  'bg-sky-100 text-sky-800': item.status === 'processing',
                  'bg-emerald-100 text-emerald-800': item.status === 'verified',
                  'bg-rose-100 text-rose-800': item.status === 'rejected'
                }"
              >
                {{ statusLabel(item.status) }}
              </span>
            </td>
            <td class="px-3 py-2 text-slate-600">{{ mimeLabel(item.mimeType) }}</td>
            <td class="px-3 py-2">
              <button
                type="button"
                class="text-sm font-semibold text-sky-700 hover:text-sky-900"
                @click="downloadItem(item)"
              >
                {{ t('prescriptions.view.download') }}
              </button>
              <ul v-if="summaryLines(item).length" class="mt-1 text-xs text-slate-500">
                <li v-for="(line, idx) in summaryLines(item)" :key="idx">{{ line }}</li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
