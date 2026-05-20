<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import { isAxiosError } from 'axios';
import {
  createPatientPrescriptionGroup,
  listPatientDiagnosisGroups,
  uploadPatientPrescriptionFile,
  type PatientPrescriptionDiagnosisGroupSummary
} from '../../services/http/patientPrescriptionApi';

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { t } = useI18n();
const { execute } = useActionEngine(props.pageConfig);
const toastStore = useToastStore(pinia);

type UploadMode = 'single' | 'frontBack' | 'sameDiagnosis';
type DiagnosisLinkTarget = 'new' | 'existing';
type QueueStatus = 'pending' | 'uploading' | 'duplicate' | 'done' | 'error';

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  message?: string;
  pageNumber?: number;
  pageLabel?: string;
};

const ACCEPT = 'application/pdf,image/jpeg,image/png';
const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const showCameraModal = ref(false);
const cameraVideoRef = ref<HTMLVideoElement | null>(null);
const cameraStream = ref<MediaStream | null>(null);
const queue = ref<QueueItem[]>([]);
const busy = ref(false);
const dragOver = ref(false);
const uploadMode = ref<UploadMode>('single');
const groupExternalId = ref<string | null>(null);
const frontBackStep = ref<'front' | 'back'>('front');
const diagnosisText = ref('');
const diagnosisLinkTarget = ref<DiagnosisLinkTarget>('new');
const existingDiagnosisGroupId = ref('');
const diagnosisGroups = ref<PatientPrescriptionDiagnosisGroupSummary[]>([]);
const diagnosisGroupsLoading = ref(false);

const canUploadSameDiagnosis = computed(() => {
  if (uploadMode.value !== 'sameDiagnosis') return true;
  if (diagnosisLinkTarget.value === 'existing') {
    return Boolean(existingDiagnosisGroupId.value.trim());
  }
  return Boolean(diagnosisText.value.trim());
});

const uploadHint = computed(() => {
  if (uploadMode.value === 'frontBack') return t('prescriptions.upload.frontBack.hint');
  if (uploadMode.value === 'sameDiagnosis') return t('prescriptions.upload.sameDiagnosis.hint');
  return t('prescriptions.upload.hint');
});

const dropHint = computed(() => {
  if (uploadMode.value === 'frontBack') return t('prescriptions.upload.frontBack.dropHint');
  if (uploadMode.value === 'sameDiagnosis') return t('prescriptions.upload.sameDiagnosis.dropHint');
  return t('prescriptions.upload.dropHint');
});

const allowMultipleFiles = computed(
  () => uploadMode.value === 'single' || uploadMode.value === 'sameDiagnosis'
);

const frontBackStepLabel = computed(() => {
  return frontBackStep.value === 'front'
    ? t('prescriptions.upload.frontBack.stepFront')
    : t('prescriptions.upload.frontBack.stepBack');
});

function newId(): string {
  return `rx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAllowedFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'image/jpeg' || mime === 'image/png') return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
}

function resetFrontBackSession(): void {
  groupExternalId.value = null;
  frontBackStep.value = 'front';
}

function resetDiagnosisSession(): void {
  groupExternalId.value = null;
}

function onUploadModeChange(mode: UploadMode): void {
  uploadMode.value = mode;
  queue.value = [];
  resetFrontBackSession();
  resetDiagnosisSession();
  if (mode === 'sameDiagnosis') void loadDiagnosisGroups();
}

async function loadDiagnosisGroups(): Promise<void> {
  diagnosisGroupsLoading.value = true;
  try {
    diagnosisGroups.value = await listPatientDiagnosisGroups();
  } catch {
    diagnosisGroups.value = [];
  } finally {
    diagnosisGroupsLoading.value = false;
  }
}

onMounted(() => {
  if (uploadMode.value === 'sameDiagnosis') void loadDiagnosisGroups();
});

watch(diagnosisLinkTarget, (target) => {
  if (target === 'existing') {
    groupExternalId.value = existingDiagnosisGroupId.value || null;
  } else {
    groupExternalId.value = null;
  }
});

watch(existingDiagnosisGroupId, (id) => {
  if (diagnosisLinkTarget.value === 'existing') {
    groupExternalId.value = id.trim() || null;
    const match = diagnosisGroups.value.find((g) => g.groupExternalId === id);
    if (match?.sharedDiagnosis) diagnosisText.value = match.sharedDiagnosis;
  }
});

function enqueueFiles(files: FileList | File[]) {
  if (uploadMode.value === 'sameDiagnosis' && !canUploadSameDiagnosis.value) {
    toastStore.show(t('prescriptions.upload.sameDiagnosis.diagnosisRequired'), 'error');
    return;
  }
  const list = Array.from(files);
  if (uploadMode.value === 'frontBack') {
    const page = frontBackStep.value === 'front' ? 1 : 2;
    const pageLabel =
      page === 1
        ? t('prescriptions.upload.frontBack.pageFront')
        : t('prescriptions.upload.frontBack.pageBack');
    const file = list[0];
    if (!file) return;
    if (!isAllowedFile(file)) {
      toastStore.show(t('prescriptions.upload.invalidType'), 'error');
      return;
    }
    if (list.length > 1) {
      toastStore.show(t('prescriptions.upload.frontBack.oneAtATime'), 'info');
    }
    queue.value.push({ id: newId(), file, status: 'pending', pageNumber: page, pageLabel });
    return;
  }
  for (const file of list) {
    if (!isAllowedFile(file)) {
      toastStore.show(t('prescriptions.upload.invalidType'), 'error');
      continue;
    }
    queue.value.push({ id: newId(), file, status: 'pending' });
  }
}

function openFilePicker(): void {
  fileInputRef.value?.click();
}

async function stopCamera(): Promise<void> {
  cameraStream.value?.getTracks().forEach((track) => track.stop());
  cameraStream.value = null;
  if (cameraVideoRef.value) {
    cameraVideoRef.value.srcObject = null;
  }
}

async function openCameraPicker(): Promise<void> {
  if (busy.value) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    cameraStream.value = stream;
    showCameraModal.value = true;
    requestAnimationFrame(() => {
      if (cameraVideoRef.value) {
        cameraVideoRef.value.srcObject = stream;
        void cameraVideoRef.value.play();
      }
    });
  } catch {
    cameraInputRef.value?.click();
  }
}

function closeCameraModal(): void {
  showCameraModal.value = false;
  void stopCamera();
}

async function captureCameraFrame(): Promise<void> {
  const video = cameraVideoRef.value;
  if (!video) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  closeCameraModal();
  if (!blob) {
    toastStore.show(t('prescriptions.upload.failed'), 'error');
    return;
  }
  const suffix = uploadMode.value === 'frontBack' && frontBackStep.value === 'back' ? 'back' : 'front';
  enqueueFiles([new File([blob], `prescription-${suffix}.jpg`, { type: 'image/jpeg' })]);
  void processQueue();
}

function onFileInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) {
    enqueueFiles(input.files);
    input.value = '';
    void processQueue();
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  dragOver.value = false;
  if (event.dataTransfer?.files?.length) {
    enqueueFiles(event.dataTransfer.files);
    void processQueue();
  }
}

function statusLabel(status: QueueStatus): string {
  switch (status) {
    case 'uploading':
      return t('prescriptions.upload.uploading');
    case 'duplicate':
      return t('prescriptions.upload.duplicate');
    case 'done':
      return t('prescriptions.upload.success');
    case 'error':
      return t('prescriptions.upload.failed');
    default:
      return '';
  }
}

async function ensureMultiPageGroup(): Promise<string> {
  if (groupExternalId.value) return groupExternalId.value;
  const created = await createPatientPrescriptionGroup({
    label: t('prescriptions.upload.frontBack.groupLabel'),
    groupType: 'multi_page'
  });
  if (!created.groupExternalId) {
    throw new Error(t('prescriptions.upload.frontBack.groupFailed'));
  }
  groupExternalId.value = created.groupExternalId;
  return created.groupExternalId;
}

async function ensureDiagnosisGroup(): Promise<string> {
  if (groupExternalId.value) return groupExternalId.value;
  if (diagnosisLinkTarget.value === 'existing') {
    const id = existingDiagnosisGroupId.value.trim();
    if (!id) throw new Error(t('prescriptions.upload.sameDiagnosis.pickExisting'));
    groupExternalId.value = id;
    return id;
  }
  const text = diagnosisText.value.trim();
  if (!text) throw new Error(t('prescriptions.upload.sameDiagnosis.diagnosisRequired'));
  const created = await createPatientPrescriptionGroup({
    label: text,
    groupType: 'diagnosis',
    sharedDiagnosis: text
  });
  if (!created.groupExternalId) {
    throw new Error(t('prescriptions.upload.sameDiagnosis.groupFailed'));
  }
  groupExternalId.value = created.groupExternalId;
  await loadDiagnosisGroups();
  return created.groupExternalId;
}

async function processQueue(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  let uploadedNew = false;
  try {
    for (const item of queue.value) {
      if (item.status !== 'pending') continue;
      item.status = 'uploading';
      try {
        let options: { groupExternalId: string; pageNumber?: number } | undefined;
        if (uploadMode.value === 'frontBack') {
          options = {
            groupExternalId: await ensureMultiPageGroup(),
            pageNumber: item.pageNumber ?? (frontBackStep.value === 'front' ? 1 : 2)
          };
        } else if (uploadMode.value === 'sameDiagnosis') {
          options = { groupExternalId: await ensureDiagnosisGroup() };
        }
        const result = await uploadPatientPrescriptionFile(item.file, options);
        if (result.isDuplicate) {
          item.status = 'duplicate';
          item.message = undefined;
        } else {
          item.status = 'done';
          item.message = t('prescriptions.upload.success');
          uploadedNew = true;
          if (uploadMode.value === 'frontBack' && (item.pageNumber ?? 1) === 1) {
            frontBackStep.value = 'back';
            toastStore.show(t('prescriptions.upload.frontBack.addBack'), 'info');
          } else if (uploadMode.value === 'frontBack' && (item.pageNumber ?? 2) === 2) {
            toastStore.show(t('prescriptions.upload.frontBack.complete'), 'success');
            resetFrontBackSession();
          }
        }
      } catch (err) {
        item.status = 'error';
        item.message = isAxiosError(err)
          ? String(err.response?.data?.message ?? err.message ?? '').trim()
          : String((err as Error)?.message ?? '').trim();
        toastStore.show(item.message || t('prescriptions.upload.failed'), 'error');
      }
    }
    await execute({ actionId: 'load-patient-prescriptions' });
    if (uploadedNew && uploadMode.value === 'single') {
      await execute({ actionId: 'open-prescription-upload-success-popup' });
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section :id="htmlId" class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">{{ t('prescriptions.upload.title') }}</h2>
      <p class="mt-1 text-sm text-slate-600">{{ uploadHint }}</p>
    </div>

    <fieldset class="space-y-2">
      <legend class="text-sm font-semibold text-slate-800">{{ t('prescriptions.upload.modeLabel') }}</legend>
      <div class="flex flex-wrap gap-4">
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="prescription-upload-mode"
            class="text-sky-600"
            :checked="uploadMode === 'single'"
            @change="onUploadModeChange('single')"
          />
          {{ t('prescriptions.upload.modeSingle') }}
        </label>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="prescription-upload-mode"
            class="text-sky-600"
            :checked="uploadMode === 'frontBack'"
            @change="onUploadModeChange('frontBack')"
          />
          {{ t('prescriptions.upload.modeFrontBack') }}
        </label>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="prescription-upload-mode"
            class="text-sky-600"
            :checked="uploadMode === 'sameDiagnosis'"
            @change="onUploadModeChange('sameDiagnosis')"
          />
          {{ t('prescriptions.upload.modeSameDiagnosis') }}
        </label>
      </div>
    </fieldset>

    <div
      v-if="uploadMode === 'sameDiagnosis'"
      class="space-y-3 rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3"
    >
      <p class="text-sm font-semibold text-violet-900">{{ t('prescriptions.upload.sameDiagnosis.setupTitle') }}</p>
      <div class="flex flex-wrap gap-4">
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="diagnosis-link-target"
            class="text-violet-600"
            :checked="diagnosisLinkTarget === 'new'"
            @change="diagnosisLinkTarget = 'new'"
          />
          {{ t('prescriptions.upload.sameDiagnosis.newDiagnosis') }}
        </label>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name="diagnosis-link-target"
            class="text-violet-600"
            :checked="diagnosisLinkTarget === 'existing'"
            @change="diagnosisLinkTarget = 'existing'"
          />
          {{ t('prescriptions.upload.sameDiagnosis.existingDiagnosis') }}
        </label>
      </div>
      <div v-if="diagnosisLinkTarget === 'new'">
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {{ t('prescriptions.upload.sameDiagnosis.diagnosisLabel') }}
        </label>
        <input
          v-model="diagnosisText"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          :placeholder="t('prescriptions.upload.sameDiagnosis.diagnosisPlaceholder')"
          :disabled="busy"
        />
      </div>
      <div v-else>
        <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {{ t('prescriptions.upload.sameDiagnosis.selectDiagnosis') }}
        </label>
        <select
          v-model="existingDiagnosisGroupId"
          class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          :disabled="busy || diagnosisGroupsLoading"
        >
          <option value="">{{ t('prescriptions.upload.sameDiagnosis.selectPlaceholder') }}</option>
          <option
            v-for="group in diagnosisGroups"
            :key="group.groupExternalId"
            :value="group.groupExternalId"
          >
            {{ group.sharedDiagnosis || group.label }}
            ({{ t('prescriptions.upload.sameDiagnosis.prescriptionCount', { count: group.prescriptionCount }) }})
          </option>
        </select>
        <p v-if="!diagnosisGroupsLoading && !diagnosisGroups.length" class="mt-1 text-xs text-slate-500">
          {{ t('prescriptions.upload.sameDiagnosis.noExisting') }}
        </p>
      </div>
      <p v-if="groupExternalId && uploadMode === 'sameDiagnosis'" class="text-xs font-medium text-violet-800">
        {{ t('prescriptions.upload.sameDiagnosis.sessionActive') }}
      </p>
    </div>

    <p
      v-if="uploadMode === 'frontBack'"
      class="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900"
    >
      {{ frontBackStepLabel }}
    </p>

    <div
      class="relative flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition"
      :class="dragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50/80'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop="onDrop"
    >
      <input
        ref="fileInputRef"
        type="file"
        class="sr-only"
        :multiple="allowMultipleFiles"
        :accept="ACCEPT"
        @change="onFileInput"
      />
      <input
        ref="cameraInputRef"
        type="file"
        class="sr-only"
        accept="image/*"
        capture="environment"
        @change="onFileInput"
      />
      <p class="text-sm font-medium text-slate-700">{{ dropHint }}</p>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50"
          :disabled="busy"
          @click="openFilePicker"
        >
          {{ t('prescriptions.upload.browse') }}
        </button>
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:opacity-50"
          :disabled="busy"
          :aria-label="t('prescriptions.upload.camera')"
          :title="t('prescriptions.upload.camera')"
          @click="openCameraPicker"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7a2 2 0 012-2h2.5L10 4h4l1.5 1H18a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        </button>
      </div>
    </div>

    <ul v-if="queue.length" class="space-y-2">
      <li
        v-for="item in queue"
        :key="item.id"
        class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        <span class="min-w-0 truncate font-medium text-slate-800">
          <span v-if="item.pageLabel" class="text-slate-500">{{ item.pageLabel }} · </span>
          {{ item.file.name }}
        </span>
        <span
          class="shrink-0 text-xs font-semibold"
          :class="{
            'text-sky-700': item.status === 'uploading',
            'text-emerald-700': item.status === 'done',
            'text-amber-700': item.status === 'duplicate',
            'text-rose-700': item.status === 'error'
          }"
        >
          {{ item.message || statusLabel(item.status) }}
        </span>
      </li>
    </ul>
    <p v-else class="text-sm text-slate-500">{{ t('prescriptions.upload.queueEmpty') }}</p>

    <div
      v-if="showCameraModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('prescriptions.upload.cameraModalTitle')"
      @click.self="closeCameraModal"
    >
      <div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div class="border-b border-slate-200 px-4 py-3">
          <h3 class="text-sm font-semibold text-slate-900">{{ t('prescriptions.upload.cameraModalTitle') }}</h3>
          <p class="mt-0.5 text-xs text-slate-500">
            {{
              uploadMode === 'frontBack'
                ? frontBackStepLabel
                : t('prescriptions.upload.cameraModalHint')
            }}
          </p>
        </div>
        <video ref="cameraVideoRef" class="aspect-[4/3] w-full bg-black object-cover" playsinline muted />
        <div class="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            @click="closeCameraModal"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
            @click="captureCameraFrame"
          >
            {{ t('prescriptions.upload.capture') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
