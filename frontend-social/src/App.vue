
<script setup lang="ts">
import { computed } from 'vue';
import { RouterView } from 'vue-router';
import { resolveStyle } from './core/engine/StyleResolver';
import GlobalPopup from './components/system/GlobalPopup.vue';
import GlobalToast from './components/system/GlobalToast.vue';
import LanguageSwitcher from './components/system/LanguageSwitcher.vue';

const shellRoot = computed(() => resolveStyle({ styleTemplate: 'shell.app.root' }));
const shellMain = computed(() => resolveStyle({ styleTemplate: 'shell.app.content' }));
</script>

<template>
  <div id="app-shell-root" :class="shellRoot">
    <div class="pointer-events-none fixed right-3 top-3 z-50 flex justify-end">
      <div class="pointer-events-auto">
        <LanguageSwitcher />
      </div>
    </div>
    <div id="app-shell-main" :class="shellMain">
      <RouterView />
    </div>
  </div>
  <GlobalPopup />
  <GlobalToast />
</template>
