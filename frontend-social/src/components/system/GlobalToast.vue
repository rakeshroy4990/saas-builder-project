<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import { useToastStore } from '../../store/useToastStore';

const toast = useToastStore();

const shell = computed(() => resolveStyle({ styleTemplate: 'system.toast.shell' }));

const variant = computed(() => {
  if (toast.type === 'error') return resolveStyle({ styleTemplate: 'system.toast.error' });
  if (toast.type === 'success') return resolveStyle({ styleTemplate: 'system.toast.success' });
  return resolveStyle({ styleTemplate: 'system.toast.info' });
});

const toastClass = computed(() => [shell.value, variant.value].filter(Boolean).join(' '));
</script>

<template>
  <Teleport to="body">
    <div v-if="toast.isVisible" id="system-toast-host" :class="toastClass">
      {{ toast.message }}
    </div>
  </Teleport>
</template>
