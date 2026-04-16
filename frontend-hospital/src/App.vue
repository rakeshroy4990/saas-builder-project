
<script setup lang="ts">
import { computed } from 'vue';
import { RouterView } from 'vue-router';
import { resolveStyle } from './core/engine/StyleResolver';
import GlobalPopup from './components/system/GlobalPopup.vue';
import GlobalToast from './components/system/GlobalToast.vue';
import ChatFab from './components/system/ChatFab.vue';

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
</template>
