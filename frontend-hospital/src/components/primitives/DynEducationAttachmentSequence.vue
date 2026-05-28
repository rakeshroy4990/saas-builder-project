<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import {
  normalizeEducationClinicalAttachments,
  type EducationClinicalAttachment
} from '../../services/domain/hospital/education/educationClinicalAttachments';

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { t } = useI18n();
const appStore = useAppStore(pinia);

const education = computed(() => {
  return (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as Record<string, unknown>;
});

const pendingFiles = computed(() =>
  normalizeEducationClinicalAttachments(education.value.attachmentSequencePending)
);

function patchPending(rows: EducationClinicalAttachment[]): void {
  const prev = education.value;
  appStore.setData('hospital', 'DoctorEducationUiState', {
    ...prev,
    attachmentSequencePending: rows
  });
}

function moveFile(index: number, direction: -1 | 1): void {
  const next = [...pendingFiles.value];
  const nextIndex = index + direction;
  if (index < 0 || index >= next.length) return;
  if (nextIndex < 0 || nextIndex >= next.length) return;
  const current = next[index];
  next[index] = next[nextIndex];
  next[nextIndex] = current;
  patchPending(next);
}
</script>

<template>
  <div :id="htmlId" class="max-h-64 space-y-2 overflow-y-auto" role="list">
    <p v-if="pendingFiles.length < 2" class="text-center text-sm text-slate-500">
      {{ t('popup.educationAttachmentSequence.empty') }}
    </p>
    <div
      v-for="(file, fileIndex) in pendingFiles"
      :key="file.id"
      class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
      role="listitem"
    >
      <span
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800"
        :aria-label="t('education.conversation.attachmentOrderLabel', { order: fileIndex + 1 })"
      >
        {{ fileIndex + 1 }}
      </span>
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-800" :title="file.name">
        {{ file.name }}
      </span>
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        :disabled="fileIndex === 0"
        :title="t('education.conversation.moveFileEarlier')"
        @click="moveFile(fileIndex, -1)"
      >
        ↑
      </button>
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        :disabled="fileIndex === pendingFiles.length - 1"
        :title="t('education.conversation.moveFileLater')"
        @click="moveFile(fileIndex, 1)"
      >
        ↓
      </button>
    </div>
  </div>
</template>
