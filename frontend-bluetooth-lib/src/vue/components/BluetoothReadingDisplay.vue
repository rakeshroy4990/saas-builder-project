<script setup lang="ts">
import type { BluetoothReading } from '../../bluetooth/types';

defineProps<{
  reading: BluetoothReading;
  compact?: boolean;
}>();

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').toUpperCase();
}
</script>

<template>
  <div
    class="rounded-lg border border-slate-200 bg-white p-3"
    :class="compact ? 'text-sm' : ''"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2 mb-2">
      <span class="font-semibold text-slate-900">{{ reading.deviceName }}</span>
      <time class="text-xs text-slate-500">{{ new Date(reading.timestamp).toLocaleString() }}</time>
    </div>
    <dl class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <div v-for="(val, key) in reading.measurements" :key="key" class="min-w-0">
        <dt class="text-xs text-slate-500 truncate">{{ formatKey(key) }}</dt>
        <dd class="font-medium text-slate-900">{{ val ?? '—' }}</dd>
      </div>
    </dl>
  </div>
</template>
