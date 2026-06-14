<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import { useToastStore } from '../../store/useToastStore';
import type { PatientPrescriptionListItem } from '../../services/http/patientPrescriptionApi';
import {
  createPatientPrescriptionGroup,
  getPatientPrescriptionDownloadUrl,
  linkPatientPrescriptionToGroup,
  listPatientDiagnosisGroups,
  type PatientPrescriptionDiagnosisGroupSummary
} from '../../services/http/patientPrescriptionApi';
import {
  buildPrescriptionDisplayRows,
  isDiagnosisGroupRow,
  isMultiPageGroupRow,
  rowMergedExtracted,
  rowPrimaryItem,
  rowStatus,
  type PrescriptionDisplayRow
} from '../../utils/patientPrescriptionGroups';
import PrescriptionValidationPanel from './PrescriptionValidationPanel.vue';

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
const displayRows = computed(() => buildPrescriptionDisplayRows(items.value));
const linkFrontExternalId = ref<string | null>(null);
const linkDiagnosisPrescriptionId = ref<string | null>(null);
const linkDiagnosisGroupId = ref('');
const linkDiagnosisNewText = ref('');
const linkDiagnosisUseNew = ref(true);
const diagnosisGroups = ref<PatientPrescriptionDiagnosisGroupSummary[]>([]);
const linking = ref(false);
const expandedSafetyId = ref<string | null>(null);
const loading = computed(() => Boolean(state.value.loading));
const error = computed(() => String(state.value.error ?? '').trim());

async function refresh(): Promise<void> {
  await execute({ actionId: 'load-patient-prescriptions' });
}

async function loadDiagnosisGroups(): Promise<void> {
  try {
    diagnosisGroups.value = await listPatientDiagnosisGroups();
  } catch {
    diagnosisGroups.value = [];
  }
}

onMounted(() => {
  void refresh();
  void loadDiagnosisGroups();
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

function startLinkFront(item: PatientPrescriptionListItem): void {
  linkFrontExternalId.value = item.externalId;
  toastStore.show(t('prescriptions.view.linkPickBack'), 'info');
}

function cancelLinkFront(): void {
  linkFrontExternalId.value = null;
}

function startLinkDiagnosis(item: PatientPrescriptionListItem): void {
  linkDiagnosisPrescriptionId.value = item.externalId;
  linkFrontExternalId.value = null;
  linkDiagnosisUseNew.value = !diagnosisGroups.value.length;
  linkDiagnosisGroupId.value = '';
  linkDiagnosisNewText.value = '';
}

function cancelLinkDiagnosis(): void {
  linkDiagnosisPrescriptionId.value = null;
  linkDiagnosisGroupId.value = '';
  linkDiagnosisNewText.value = '';
}

async function confirmLinkDiagnosis(): Promise<void> {
  const prescriptionId = String(linkDiagnosisPrescriptionId.value ?? '').trim();
  if (!prescriptionId) return;
  linking.value = true;
  try {
    let groupId = linkDiagnosisGroupId.value.trim();
    if (linkDiagnosisUseNew.value) {
      const text = linkDiagnosisNewText.value.trim();
      if (!text) {
        toastStore.show(t('prescriptions.view.linkDiagnosisTextRequired'), 'error');
        return;
      }
      const created = await createPatientPrescriptionGroup({
        label: text,
        groupType: 'diagnosis',
        sharedDiagnosis: text
      });
      groupId = created.groupExternalId;
    }
    if (!groupId) {
      toastStore.show(t('prescriptions.view.linkDiagnosisPickRequired'), 'error');
      return;
    }
    await linkPatientPrescriptionToGroup(groupId, prescriptionId);
    cancelLinkDiagnosis();
    toastStore.show(t('prescriptions.view.linkDiagnosisSuccess'), 'success');
    await loadDiagnosisGroups();
    await refresh();
  } catch {
    toastStore.show(t('prescriptions.view.linkDiagnosisFailed'), 'error');
  } finally {
    linking.value = false;
  }
}

async function linkAsBackPage(backItem: PatientPrescriptionListItem): Promise<void> {
  const frontId = String(linkFrontExternalId.value ?? '').trim();
  const backId = String(backItem.externalId ?? '').trim();
  if (!frontId || !backId || frontId === backId) return;
  linking.value = true;
  try {
    const { groupExternalId } = await createPatientPrescriptionGroup({
      label: t('prescriptions.upload.frontBack.groupLabel'),
      groupType: 'multi_page'
    });
    await linkPatientPrescriptionToGroup(groupExternalId, frontId, 1);
    await linkPatientPrescriptionToGroup(groupExternalId, backId, 2);
    linkFrontExternalId.value = null;
    toastStore.show(t('prescriptions.view.linkSuccess'), 'success');
    await refresh();
  } catch {
    toastStore.show(t('prescriptions.view.linkFailed'), 'error');
  } finally {
    linking.value = false;
  }
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

function summaryLinesForRow(row: PrescriptionDisplayRow): string[] {
  const primary = rowPrimaryItem(row);
  const ex = rowMergedExtracted(row);
  const item = primary;
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
    <p v-else-if="!displayRows.length" class="text-sm text-slate-500">{{ t('prescriptions.view.empty') }}</p>

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
          <tr v-for="row in displayRows" :key="row.kind === 'group' ? row.groupExternalId : row.item.externalId">
            <td class="px-3 py-2 text-slate-800">
              {{ formatDate(rowPrimaryItem(row).createdAt) }}
              <span
                v-if="row.kind === 'group' && isDiagnosisGroupRow(row)"
                class="mt-0.5 block text-xs font-medium text-violet-800"
              >
                {{ t('prescriptions.view.diagnosisBadge', { count: row.pages.length }) }}
              </span>
              <span
                v-else-if="row.kind === 'group'"
                class="mt-0.5 block text-xs font-medium text-sky-700"
              >
                {{ t('prescriptions.view.multiPageBadge', { count: row.pages.length }) }}
              </span>
              <span
                v-if="row.kind === 'group' && isDiagnosisGroupRow(row) && row.sharedDiagnosis"
                class="mt-0.5 block text-xs text-violet-700"
              >
                {{ row.sharedDiagnosis }}
              </span>
            </td>
            <td class="px-3 py-2">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="{
                  'bg-slate-100 text-slate-700': rowStatus(row) === 'pending',
                  'bg-sky-100 text-sky-800': rowStatus(row) === 'processing',
                  'bg-emerald-100 text-emerald-800': rowStatus(row) === 'verified',
                  'bg-rose-100 text-rose-800': rowStatus(row) === 'rejected'
                }"
              >
                {{ statusLabel(rowStatus(row)) }}
              </span>
            </td>
            <td class="px-3 py-2 text-slate-600">
              <template v-if="row.kind === 'group' && isDiagnosisGroupRow(row)">
                <span class="block text-xs text-violet-700">{{ t('prescriptions.view.diagnosisType') }}</span>
              </template>
              <template v-else-if="row.kind === 'group'">
                <span class="block text-xs text-slate-500">{{ t('prescriptions.view.multiPageType') }}</span>
              </template>
              <template v-else>
                {{ mimeLabel(row.item.mimeType) }}
              </template>
            </td>
            <td class="px-3 py-2">
              <template v-if="row.kind === 'group'">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(page, idx) in row.pages"
                    :key="page.externalId"
                    type="button"
                    class="text-sm font-semibold text-sky-700 hover:text-sky-900"
                    @click="downloadItem(page)"
                  >
                    {{
                      isMultiPageGroupRow(row)
                        ? page.pageNumber === 1
                          ? t('prescriptions.view.downloadFront')
                          : t('prescriptions.view.downloadBack')
                        : t('prescriptions.view.downloadPrescription', { n: idx + 1 })
                    }}
                  </button>
                </div>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="text-sm font-semibold text-sky-700 hover:text-sky-900"
                  @click="downloadItem(row.item)"
                >
                  {{ t('prescriptions.view.download') }}
                </button>
                <button
                  v-if="rowStatus(row) === 'verified'"
                  type="button"
                  class="ml-3 text-sm font-semibold text-violet-700 hover:text-violet-900"
                  @click="expandedSafetyId = expandedSafetyId === row.item.externalId ? null : row.item.externalId"
                >
                  {{ t('prescriptionSafety.viewSafety') }}
                </button>
                <div v-if="expandedSafetyId === row.item.externalId" class="mt-3">
                  <PrescriptionValidationPanel
                    :prescription-external-id="row.item.externalId"
                    :doctor-view="false"
                  />
                </div>
                <div
                  v-if="linkDiagnosisPrescriptionId === row.item.externalId"
                  class="mt-2 space-y-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2"
                >
                  <p class="text-xs font-semibold text-violet-900">{{ t('prescriptions.view.linkDiagnosisTitle') }}</p>
                  <div class="flex flex-wrap gap-3">
                    <label class="inline-flex items-center gap-1 text-xs">
                      <input v-model="linkDiagnosisUseNew" type="radio" :value="true" />
                      {{ t('prescriptions.view.linkDiagnosisNew') }}
                    </label>
                    <label class="inline-flex items-center gap-1 text-xs">
                      <input v-model="linkDiagnosisUseNew" type="radio" :value="false" :disabled="!diagnosisGroups.length" />
                      {{ t('prescriptions.view.linkDiagnosisExisting') }}
                    </label>
                  </div>
                  <input
                    v-if="linkDiagnosisUseNew"
                    v-model="linkDiagnosisNewText"
                    type="text"
                    class="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                    :placeholder="t('prescriptions.view.linkDiagnosisPlaceholder')"
                  />
                  <select
                    v-else
                    v-model="linkDiagnosisGroupId"
                    class="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="">{{ t('prescriptions.upload.sameDiagnosis.selectPlaceholder') }}</option>
                    <option v-for="g in diagnosisGroups" :key="g.groupExternalId" :value="g.groupExternalId">
                      {{ g.sharedDiagnosis || g.label }}
                    </option>
                  </select>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="text-xs font-semibold text-violet-800"
                      :disabled="linking"
                      @click="confirmLinkDiagnosis"
                    >
                      {{ t('prescriptions.view.linkDiagnosisConfirm') }}
                    </button>
                    <button type="button" class="text-xs text-slate-600" @click="cancelLinkDiagnosis">
                      {{ t('prescriptions.view.linkCancel') }}
                    </button>
                  </div>
                </div>
                <div v-else-if="!row.item.groupExternalId" class="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="text-xs font-semibold text-violet-700 hover:text-violet-900"
                    :disabled="linking"
                    @click="startLinkDiagnosis(row.item)"
                  >
                    {{ t('prescriptions.view.linkToDiagnosis') }}
                  </button>
                  <button
                    v-if="linkFrontExternalId === row.item.externalId"
                    type="button"
                    class="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    :disabled="linking"
                    @click="cancelLinkFront"
                  >
                    {{ t('prescriptions.view.linkCancel') }}
                  </button>
                  <button
                    v-else-if="!linkFrontExternalId"
                    type="button"
                    class="text-xs font-semibold text-sky-700 hover:text-sky-900"
                    :disabled="linking"
                    @click="startLinkFront(row.item)"
                  >
                    {{ t('prescriptions.view.linkAsFront') }}
                  </button>
                  <button
                    v-else-if="linkFrontExternalId && linkFrontExternalId !== row.item.externalId"
                    type="button"
                    class="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                    :disabled="linking"
                    @click="linkAsBackPage(row.item)"
                  >
                    {{ t('prescriptions.view.linkAsBack') }}
                  </button>
                </div>
              </template>
              <ul v-if="summaryLinesForRow(row).length" class="mt-1 text-xs text-slate-500">
                <li v-for="(line, idx) in summaryLinesForRow(row)" :key="idx">{{ line }}</li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
