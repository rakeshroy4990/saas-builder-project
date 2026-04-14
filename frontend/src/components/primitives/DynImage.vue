<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { StyleConfig } from '../../core/types/StyleConfig';
import type { PageConfig } from '../../core/types/PageConfig';

interface ImageConfig {
  src: string;
  alt?: string;
  styles?: StyleConfig;
}

const props = defineProps<{ config?: ImageConfig; pageConfig: PageConfig; htmlId?: string }>();
const classes = computed(() =>
  [resolveStyle({ styleTemplate: 'chrome.image.block' }), resolveStyle(props.config?.styles)]
    .filter(Boolean)
    .join(' ')
);
</script>

<template>
  <img
    :id="htmlId"
    :class="classes"
    :src="config?.src"
    :alt="config?.alt ?? 'image'"
    loading="lazy"
    decoding="async"
  />
</template>
