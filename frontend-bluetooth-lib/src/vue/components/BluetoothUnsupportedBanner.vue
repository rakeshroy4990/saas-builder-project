<script setup lang="ts">
import { getBluetoothUnsupportedReason } from '../../bluetooth/bluetoothSupport';
</script>

<template>
  <div
    class="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-sm text-amber-900"
    role="alert"
  >
    <span class="text-xl shrink-0" aria-hidden="true">📵</span>
    <div class="space-y-1">
      <strong class="block font-semibold">Device connection unavailable</strong>
      <p>{{ getBluetoothUnsupportedReason() }}</p>
      <p class="text-amber-800">
        For medical device integration, use
        <strong>Chrome on Android</strong> or <strong>Chrome/Edge on desktop</strong>.
      </p>
    </div>
  </div>
</template>
