<script setup lang="ts">
import { computed } from 'vue';
import type { ActionConfig } from '@/core/types/ActionConfig';
import { useAppStore } from '@/store/useAppStore';
import { resolveStyle } from '@/core/engine/StyleResolver';

type DynVideoCallConfig = {
  packageName?: string;
  storeKey?: string;
  acceptAction?: ActionConfig;
  rejectAction?: ActionConfig;
  endAction?: ActionConfig;
  heartbeatAction?: ActionConfig;
  styles?: { utilityClasses?: string };
};

const props = defineProps<{ config?: DynVideoCallConfig; htmlId?: string }>();
const emit = defineEmits<{ action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }] }>();

const appStore = useAppStore();
const pkg = computed(() => props.config?.packageName ?? 'hospital');
const key = computed(() => props.config?.storeKey ?? 'VideoCall');
const call = computed(() => (appStore.getData(pkg.value, key.value) ?? {}) as Record<string, unknown>);
const callId = computed(() => String(call.value.callId ?? '').trim());
const lastSignalType = computed(() => String(call.value.lastSignalType ?? '').trim());
const rootClass = computed(() => resolveStyle({ utilityClasses: props.config?.styles?.utilityClasses ?? 'w-full' }));

const accept = () => emit('action', { action: props.config?.acceptAction, payload: { callId: callId.value } });
const reject = () => emit('action', { action: props.config?.rejectAction, payload: { callId: callId.value } });
const end = () => emit('action', { action: props.config?.endAction, payload: { callId: callId.value } });
const heartbeat = () =>
  emit('action', { action: props.config?.heartbeatAction, payload: { callId: callId.value } });
</script>

<template>
  <div :id="htmlId" :class="rootClass">
    <div class="flex items-center justify-between">
      <div class="text-lg font-semibold text-slate-900">Video call</div>
      <button
        class="rounded border border-slate-300 px-3 py-1 text-sm"
        type="button"
        :disabled="!callId"
        @click="heartbeat"
      >
        Heartbeat
      </button>
    </div>

    <div class="mt-3 rounded-lg border border-slate-200 p-3">
      <div class="text-sm text-slate-700">
        <div><span class="font-semibold">CallId:</span> {{ callId || '-' }}</div>
        <div><span class="font-semibold">Last signal:</span> {{ lastSignalType || '-' }}</div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button class="rounded bg-emerald-600 px-4 py-2 text-sm text-white" type="button" :disabled="!callId" @click="accept">
          Accept
        </button>
        <button class="rounded bg-rose-600 px-4 py-2 text-sm text-white" type="button" :disabled="!callId" @click="reject">
          Reject
        </button>
        <button class="rounded border border-slate-300 px-4 py-2 text-sm" type="button" :disabled="!callId" @click="end">
          End
        </button>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="aspect-video rounded bg-slate-900/5 text-center text-xs text-slate-500 flex items-center justify-center">
          Local video (wire getUserMedia)
        </div>
        <div class="aspect-video rounded bg-slate-900/5 text-center text-xs text-slate-500 flex items-center justify-center">
          Remote video (wire RTCPeerConnection)
        </div>
      </div>
    </div>
  </div>
</template>

