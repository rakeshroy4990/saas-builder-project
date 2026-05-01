<script setup lang="ts">
import { computed } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { StyleConfig } from '../../core/types/StyleConfig';

interface YoutubeEmbedConfig {
  videoId?: string;
  /** Optional aspect hint: 'shorts' renders a narrower vertical frame. */
  aspectMode?: 'shorts' | 'video' | 'auto' | string;
  /** iframe title / a11y */
  title?: string;
  styles?: StyleConfig;
}

const props = defineProps<{ config?: YoutubeEmbedConfig; htmlId?: string }>();

const videoId = computed(() => String(props.config?.videoId ?? '').trim());

const wrapperClasses = computed(() => resolveStyle(props.config?.styles));

function isShortsById(id: string): boolean {
  const t = id.trim().toLowerCase();
  if (!t) return false;
  return t.includes('/shorts/') || t.startsWith('shorts/');
}

const isShorts = computed(() => {
  const mode = String(props.config?.aspectMode ?? 'auto').trim().toLowerCase();
  if (mode === 'shorts') return true;
  if (mode === 'video') return false;
  return isShortsById(videoId.value);
});

const embedSrc = computed(() => {
  const id = videoId.value;
  if (!id) {
    return '';
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
});

const iframeTitle = computed(() => props.config?.title?.trim() || 'YouTube video');
</script>

<template>
  <div
    v-if="videoId"
    :id="htmlId"
    :class="[wrapperClasses, isShorts ? 'mx-auto aspect-[9/16] w-full max-w-[22rem]' : 'aspect-video w-full']"
  >
    <iframe
      class="absolute inset-0 h-full w-full rounded-[inherit]"
      :src="embedSrc"
      :title="iframeTitle"
      loading="lazy"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    />
  </div>
</template>
