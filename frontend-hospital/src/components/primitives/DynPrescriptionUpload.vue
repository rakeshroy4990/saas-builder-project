<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import { isAxiosError } from 'axios';
import { uploadPatientPrescriptionFile } from '../../services/http/patientPrescriptionApi';

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { t } = useI18n();
const { execute } = useActionEngine(props.pageConfig);
const toastStore = useToastStore(pinia);

type QueueStatus = 'pending' | 'uploading' | 'duplicate' | 'done' | 'error';

type QueueItem = {
  id: string;
  file: File;
  status: QueueStatus;
  message?: string;
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

function newId(): string {
  return `rx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAllowedFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'application/pdf' || mime === 'image/jpeg' || mime === 'image/png') return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png');
}

function enqueueFiles(files: FileList | File[]) {
  const list = Array.from(files);
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
  enqueueFiles([new File([blob], 'prescription-camera.jpg', { type: 'image/jpeg' })]);
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

async function processQueue(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  let uploadedNew = false;
  try {
    for (const item of queue.value) {
      if (item.status !== 'pending') continue;
      item.status = 'uploading';
      try {
        const result = await uploadPatientPrescriptionFile(item.file);
        if (result.isDuplicate) {
          item.status = 'duplicate';
          item.message = undefined;
        } else {
          item.status = 'done';
          item.message = t('prescriptions.upload.success');
          uploadedNew = true;
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
    if (uploadedNew) {
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
      <p class="mt-1 text-sm text-slate-600">{{ t('prescriptions.upload.hint') }}</p>
    </div>

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
        multiple
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
      <p class="text-sm font-medium text-slate-700">{{ t('prescriptions.upload.dropHint') }}</p>
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
        <span class="min-w-0 truncate font-medium text-slate-800">{{ item.file.name }}</span>
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
          <p class="mt-0.5 text-xs text-slate-500">{{ t('prescriptions.upload.cameraModalHint') }}</p>
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
