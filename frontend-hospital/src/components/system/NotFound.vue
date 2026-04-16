<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';

const boxClass = computed(() => resolveStyle({ styleTemplate: 'system.notFound.container' }));
</script>

<template>
  <div id="system-route-not-found" :class="boxClass">Page not found.</div>
</template>
