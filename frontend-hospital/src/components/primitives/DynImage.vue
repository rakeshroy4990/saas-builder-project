<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';
import type { PageConfig } from '../../core/types/PageConfig';
import { resolveImageSource } from '../../services/media/cloudinary';

interface ImageConfig {
  src: string;
  alt?: string;
  styles?: StyleConfig;
  click?: ActionConfig;
}

const props = defineProps<{ config?: ImageConfig; pageConfig: PageConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();

const classes = computed(() =>
  [resolveStyle({ styleTemplate: 'chrome.image.block' }), resolveStyle(props.config?.styles)]
    .filter(Boolean)
    .join(' ')
);
const imageSrc = computed(() => resolveImageSource(props.config?.src));

const interactiveRing = computed(() =>
  props.config?.click ? ' cursor-pointer rounded-full ring-offset-2 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500' : ''
);

const onClick = async () => {
  if (props.config?.click) {
    emit('action', { action: props.config.click, payload: {} });
  }
};

const onKeydown = (e: KeyboardEvent) => {
  if (!props.config?.click) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    void onClick();
  }
};
</script>

<template>
  <img
    v-if="config?.click"
    :id="htmlId"
    role="link"
    tabindex="0"
    :class="[classes, interactiveRing]"
    :src="imageSrc"
    :alt="config?.alt ?? 'image'"
    loading="lazy"
    decoding="async"
    @click="onClick"
    @keydown="onKeydown"
  />
  <img
    v-else
    :id="htmlId"
    :class="classes"
    :src="imageSrc"
    :alt="config?.alt ?? 'image'"
    loading="lazy"
    decoding="async"
  />
</template>
