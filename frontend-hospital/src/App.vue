
<script setup lang="ts">
import { computed } from 'vue';
import { RouterView } from 'vue-router';
import { resolveStyle } from './core/engine/StyleResolver';
import { useHospitalProfileMenuPointerOutsideClose } from './composables/useHospitalProfileMenuPointerOutsideClose';
import GlobalPopup from './components/system/GlobalPopup.vue';
import GlobalToast from './components/system/GlobalToast.vue';
import ChatFab from './components/system/ChatFab.vue';
import PerfOverlay from './components/dev/PerfOverlay.vue';

useHospitalProfileMenuPointerOutsideClose();

const isPerfEnabled = import.meta.env.VITE_PERF_ENABLED === 'true';

const shellRoot = computed(() => resolveStyle({ styleTemplate: 'shell.app.root' }));
const shellMain = computed(() => resolveStyle({ styleTemplate: 'shell.app.content' }));
</script>

<template>
  <div id="app-shell-root" :class="shellRoot">
    <div id="app-shell-main" :class="shellMain">
      <RouterView />
    </div>
  </div>
  <ChatFab />
  <GlobalPopup />
  <GlobalToast />
  <PerfOverlay v-if="isPerfEnabled" />
</template>
