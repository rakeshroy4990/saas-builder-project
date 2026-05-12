<script setup lang="ts">
import { computed } from 'vue';
import type { PageConfig } from '../../core/types/PageConfig';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import DynDoctorEducationFlashcards from './DynDoctorEducationFlashcards.vue';
import DynDoctorEducationConversation from './DynDoctorEducationConversation.vue';

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const appStore = useAppStore(pinia);

const education = computed(() => {
  return (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as Record<string, unknown>;
});

const uiMode = computed<'flashcards' | 'conversation'>(() => {
  return String(education.value.uiMode ?? '').trim().toLowerCase() === 'flashcards'
    ? 'flashcards'
    : 'conversation';
});
</script>

<template>
  <div :id="htmlId">
    <DynDoctorEducationFlashcards
      v-if="uiMode === 'flashcards'"
      :page-config="pageConfig"
      :config="config"
      :html-id="htmlId ? `${htmlId}-flashcards` : undefined"
    />
    <DynDoctorEducationConversation
      v-else
      :page-config="pageConfig"
      :config="config"
      :html-id="htmlId ? `${htmlId}-conversation` : undefined"
    />
  </div>
</template>
