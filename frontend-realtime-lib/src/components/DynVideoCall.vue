<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ActionConfig } from '@/core/types/ActionConfig';
import { useAppStore } from '@/store/useAppStore';
import { resolveStyle } from '@/core/engine/StyleResolver';
import { stompClient } from '@/services/realtime/stompClient';
import { createVideoRoomAdapter, resolveVideoProviderFromEnv } from '../video/VideoRoomAdapter';

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
const remotePartyName = computed(() => String(call.value.remotePartyName ?? '').trim());
const inviteToUserId = computed(() => String(call.value.inviteToUserId ?? '').trim());
/** Incoming callee UI: hide Accept after server echoes accept (or call ended). */
const showAcceptButton = computed(() => {
  if (!callId.value) return false;
  if (inviteToUserId.value) return false;
  const s = lastSignalType.value.trim().toLowerCase();
  if (s === 'accept' || s === 'reject' || s === 'end') return false;
  return true;
});
const sessionShort = computed(() => {
  const id = callId.value;
  if (!id) return '';
  return id.length > 12 ? `…${id.slice(-8)}` : id;
});
const rootClass = computed(() => resolveStyle({ utilityClasses: props.config?.styles?.utilityClasses ?? 'w-full' }));

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);
const videosPanel = ref<HTMLElement | null>(null);
const isVideosFullscreen = ref(false);
const sessionActive = ref(true);

const accept = () => emit('action', { action: props.config?.acceptAction, payload: { callId: callId.value } });
const reject = () => emit('action', { action: props.config?.rejectAction, payload: { callId: callId.value } });
const end = () => emit('action', { action: props.config?.endAction, payload: { callId: callId.value } });
const heartbeat = () =>
  emit('action', { action: props.config?.heartbeatAction, payload: { callId: callId.value } });

function syncVideosFullscreenState() {
  const panel = videosPanel.value;
  const fs = document.fullscreenElement;
  isVideosFullscreen.value = Boolean(panel && fs && panel.contains(fs));
}

async function toggleVideosFullscreen() {
  const panel = videosPanel.value;
  if (!panel) return;
  try {
    if (!document.fullscreenElement) {
      await panel.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    // Browser may block fullscreen without user gesture; ignore.
  }
  syncVideosFullscreenState();
}

function publishSignal(type: string, id: string, payload: Record<string, unknown>) {
  if (!id) {
    console.error('[WebRTC] publishSignal skipped: missing callId', { type, payload });
    return;
  }
  void stompClient
    .connect()
    .then(() => {
      stompClient.publish('/app/webrtc.signal', { type, callId: id, payload });
    })
    .catch((err: unknown) => {
      console.error('[WebRTC] publishSignal failed', { type, callId: id, err });
    });
}

const videoProvider = resolveVideoProviderFromEnv(import.meta.env as Record<string, unknown>);
const room = createVideoRoomAdapter(videoProvider, {
  call,
  callId,
  pkg,
  key,
  localVideo,
  remoteVideo,
  sessionActive,
  appStore,
  publishSignal,
  getEnv: () => import.meta.env as Record<string, unknown>,
  isDev: () => import.meta.env.DEV
});
const mediaError = room.mediaError;

onMounted(() => {
  sessionActive.value = true;
  document.addEventListener('fullscreenchange', syncVideosFullscreenState);
  room.mount();
});

onBeforeUnmount(() => {
  room.unmount();
  document.removeEventListener('fullscreenchange', syncVideosFullscreenState);
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
  }
});
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
        <div>
          <span class="font-semibold">Call with:</span>
          {{ remotePartyName || '—' }}
        </div>
        <div v-if="sessionShort" class="mt-1 text-xs text-slate-500">
          <span class="font-medium text-slate-600">Session ref:</span>
          {{ sessionShort }}
        </div>
        <div class="mt-1">
          <span class="font-semibold">Last signal:</span>
          {{ lastSignalType || '—' }}
        </div>
        <p v-if="mediaError" class="mt-2 text-sm text-rose-600">{{ mediaError }}</p>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button
          class="rounded border border-slate-400 px-3 py-2 text-sm text-slate-800"
          type="button"
          @click="toggleVideosFullscreen"
        >
          {{ isVideosFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
        </button>
        <button
          v-show="showAcceptButton"
          class="rounded bg-emerald-600 px-4 py-2 text-sm text-white"
          type="button"
          :disabled="!callId"
          @click="accept"
        >
          Accept
        </button>
        <button
          v-show="showAcceptButton"
          class="rounded bg-rose-600 px-4 py-2 text-sm text-white"
          type="button"
          :disabled="!callId"
          @click="reject"
        >
          Reject
        </button>
        <button class="rounded border border-slate-300 px-4 py-2 text-sm" type="button" :disabled="!callId" @click="end">
          End
        </button>
      </div>

      <!-- Default: two tiles (in-flow). Fullscreen only: remote full-bleed + local PiP. Same video refs for the adapter. -->
      <div
        ref="videosPanel"
        :class="[
          'mt-4 w-full bg-black',
          isVideosFullscreen
            ? 'relative h-full min-h-[100dvh] overflow-hidden rounded-none sm:min-h-screen'
            : 'grid grid-cols-1 gap-3 overflow-hidden rounded-lg md:grid-cols-2'
        ]"
      >
        <video
          ref="localVideo"
          :class="[
            'bg-black object-cover',
            isVideosFullscreen
              ? 'absolute bottom-3 right-3 z-10 aspect-video w-[32%] max-w-[200px] rounded-lg shadow-lg ring-2 ring-white/25 sm:bottom-4 sm:right-4 sm:max-w-[min(240px,28vw)]'
              : 'aspect-video w-full rounded'
          ]"
          autoplay
          playsinline
          muted
          aria-label="Your camera"
        />
        <video
          ref="remoteVideo"
          :class="[
            'bg-black object-cover',
            isVideosFullscreen
              ? 'absolute inset-0 z-0 h-full w-full rounded-none'
              : 'aspect-video w-full rounded'
          ]"
          playsinline
          aria-label="Remote participant"
        />
      </div>
    </div>
  </div>
</template>
