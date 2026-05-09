<script setup lang="ts">
import LanguageSwitcher from '../system/LanguageSwitcher.vue';

defineProps<{
  /** Declarative parity with other primitives; unused. */
  config?: Record<string, unknown>;
}>();
</script>

<template>
  <div class="flex shrink-0 items-center">
    <LanguageSwitcher />
  </div>
</template>
