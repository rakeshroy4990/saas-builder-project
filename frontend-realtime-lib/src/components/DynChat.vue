<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ActionConfig } from '@/core/types/ActionConfig';
import { useAppStore } from '@/store/useAppStore';
import { resolveStyle } from '@/core/engine/StyleResolver';

type DynChatConfig = {
  packageName?: string;
  storeKey?: string;
  /**
   * When true, renders as a flat embedded widget (no extra outer card).
   * Use inside `system.popup.panel.chatWidget`.
   */
  embedded?: boolean;
  /**
   * Creates/loads a direct room (and activates it in the store).
   * Used by the UI button instead of showing "Rooms".
   */
  startChatAction?: ActionConfig;
  acceptSupportRequestAction?: ActionConfig;
  rejectSupportRequestAction?: ActionConfig;
  sendMessageAction?: ActionConfig;
  /**
   * Used by `startChatAction` payload as `otherUserId`.
   * Default in services is a "support" placeholder.
   */
  supportUserId?: string;
  /**
   * When true, auto-creates the direct room on first render
   * (so the user can immediately start typing).
   */
  autoStart?: boolean;
  styles?: { utilityClasses?: string };
};

const props = defineProps<{ config?: DynChatConfig; htmlId?: string }>();
const emit = defineEmits<{ action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }] }>();

const packageName = computed(() => props.config?.packageName ?? 'hospital');
const storeKey = computed(() => props.config?.storeKey ?? 'Chat');
const appStore = useAppStore();

const chat = computed(() => (appStore.getData(packageName.value, storeKey.value) ?? {}) as Record<string, unknown>);
const chatStatus = computed(() => String(chat.value.status ?? '').trim());
const isWaitingForAdmin = computed(() => chatStatus.value === 'waiting_for_admin');
const activeRoomId = computed(() => String(chat.value.activeRoomId ?? '').trim());
const messagesByRoomId = computed(() => (chat.value.messagesByRoomId ?? {}) as Record<string, unknown>);
const pendingMessages = computed(() => {
  const arr = (chat.value.pendingMessages ?? []) as unknown;
  return Array.isArray(arr) ? (arr as any[]) : [];
});
const supportRequests = computed(() => {
  const arr = (chat.value.supportRequests ?? []) as unknown;
  return Array.isArray(arr) ? (arr as any[]) : [];
});
const authSession = computed(() => (appStore.getData(packageName.value, 'AuthSession') ?? {}) as Record<string, unknown>);
const myUserId = computed(() => String(authSession.value.userId ?? '').trim());
const myRole = computed(() => String(authSession.value.role ?? '').trim().toUpperCase());
const isAdmin = computed(() => myRole.value === 'ADMIN');
const myDisplayName = computed(() => {
  const fullName = String(authSession.value.fullName ?? '').trim();
  if (fullName) return fullName;
  const display = String(authSession.value.userDisplayName ?? '').trim();
  if (display) return display;
  const email = String(authSession.value.email ?? '').trim();
  if (email) return email;
  return 'Me';
});

const looksLikeMongoId = (value: string): boolean => /^[a-f0-9]{24}$/i.test(value);

const resolveSenderLabel = (m: any): string => {
  const senderDisplayName = String(
    m?.senderDisplayName ??
      m?.senderName ??
      m?.displayName ??
      m?.fromUserDisplayName ??
      m?.fromUserName ??
      m?.userName ??
      m?.username ??
      m?.name ??
      m?.fullName ??
      m?.senderFullName ??
      m?.SenderDisplayName ??
      m?.SenderName ??
      ''
  ).trim();
  if (senderDisplayName) return senderDisplayName;
  const senderId = String(m?.senderId ?? '').trim();
  if (!senderId) return '';
  if (senderId === 'me') return myDisplayName.value;
  if (myUserId.value && senderId === myUserId.value) return myDisplayName.value;
  if (senderId === (props.config?.supportUserId ?? 'support')) return 'Support';
  if (looksLikeMongoId(senderId)) return isAdmin.value ? 'Patient' : 'Support';
  return senderId.length > 32 ? `${senderId.slice(0, 12)}…` : senderId;
};

const isMine = (m: any): boolean => {
  const senderId = String(m?.senderId ?? '').trim();
  if (!senderId) return false;
  if (senderId === 'me') return true;
  if (myUserId.value && senderId === myUserId.value) return true;
  return false;
};

const formatTime = (m: any): string => {
  const raw = String(m?.createdTimestamp ?? '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const activeMessages = computed(() => {
  const rid = activeRoomId.value;
  if (!rid) return [];
  const arr = messagesByRoomId.value[rid];
  return Array.isArray(arr) ? (arr as any[]) : [];
});

const draft = ref('');
const messagesScrollEl = ref<HTMLElement | null>(null);

function scrollMessagesToBottom() {
  void nextTick(() => {
    const el = messagesScrollEl.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  });
}

watch(activeRoomId, () => scrollMessagesToBottom());
watch(activeMessages, () => scrollMessagesToBottom(), { deep: true });
watch(pendingMessages, () => scrollMessagesToBottom(), { deep: true });

const activeInlineEditKey = ref('');
const inlineEditText = ref('');
const rootClass = computed(() =>
  resolveStyle({ utilityClasses: props.config?.styles?.utilityClasses ?? 'w-full' })
);
const embedded = computed(() => Boolean(props.config?.embedded));
const shellClass = computed(() =>
  embedded.value
    ? 'flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-white'
    : 'flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm'
);

let didAutoStart = false;
const autoStartEnabled = computed(() => props.config?.autoStart ?? true);

const startChat = async () => {
  emit('action', {
    action: props.config?.startChatAction,
    payload: { otherUserId: props.config?.supportUserId ?? 'support' }
  });
};

const acceptSupport = async (requestId: string) => {
  const rid = String(requestId ?? '').trim();
  if (!rid) return;
  emit('action', { action: props.config?.acceptSupportRequestAction, payload: { requestId: rid } });
};

const rejectSupport = async (requestId: string) => {
  const rid = String(requestId ?? '').trim();
  if (!rid) return;
  emit('action', { action: props.config?.rejectSupportRequestAction, payload: { requestId: rid } });
};

onMounted(() => {
  if (!autoStartEnabled.value) return;
  if (!props.config?.startChatAction) return;
  if (activeRoomId.value) return;
  if (didAutoStart) return;
  didAutoStart = true;
  startChat();
});

const send = async () => {
  const rid = activeRoomId.value;
  const body = draft.value.trim();
  if (!body) return;
  if (!rid && !isWaitingForAdmin.value && chatStatus.value !== 'starting' && chatStatus.value !== 'connecting') return;
  draft.value = '';
  emit('action', {
    action: props.config?.sendMessageAction,
    payload: { roomId: rid, body, clientMessageId: crypto.randomUUID() }
  });
};

const canSendNow = computed(
  () =>
    Boolean(activeRoomId.value) ||
    isWaitingForAdmin.value ||
    chatStatus.value === 'starting' ||
    chatStatus.value === 'connecting'
);

const messageKey = (m: any): string =>
  String(m?.messageId ?? m?.clientMessageId ?? `${m?.senderId ?? ''}-${m?.createdTimestamp ?? ''}`);

const editMessage = (m: any) => {
  const body = String(m?.body ?? '').trim();
  if (!body) return;
  activeInlineEditKey.value = messageKey(m);
  inlineEditText.value = body;
};

const resendMessage = (m: any) => {
  if (!canSendNow.value) return;
  const body = String(m?.body ?? '').trim();
  if (!body) return;
  emit('action', {
    action: props.config?.sendMessageAction,
    payload: { roomId: activeRoomId.value, body, clientMessageId: crypto.randomUUID() }
  });
};

const cancelInlineEdit = () => {
  activeInlineEditKey.value = '';
  inlineEditText.value = '';
};

const sendInlineEdit = (m: any) => {
  if (!canSendNow.value) return;
  const body = inlineEditText.value.trim();
  if (!body) return;
  emit('action', {
    action: props.config?.sendMessageAction,
    payload: { roomId: activeRoomId.value, body, clientMessageId: crypto.randomUUID() }
  });
  // Keep original message immutable; edited text is sent as a new message.
  cancelInlineEdit();
};
</script>

<template>
  <div :id="htmlId" :class="rootClass">
    <div :class="shellClass">
      <div
        ref="messagesScrollEl"
        class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain bg-slate-50/50 p-3 sm:p-4 [-webkit-overflow-scrolling:touch]"
      >
        <div v-if="isAdmin && supportRequests.length > 0" class="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div class="text-sm font-semibold text-amber-900">Incoming chat request</div>
          <div class="mt-1 text-xs text-amber-800">An admin can accept to start a 1:1 chat.</div>
          <div class="mt-3 flex flex-col gap-2">
            <div
              v-for="r in supportRequests"
              :key="String(r?.requestId ?? r?.id ?? r?.requesterUserId ?? '')"
              class="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
            >
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-slate-900">
                  {{ String(r?.requesterDisplayName ?? r?.requesterUserId ?? 'Patient') }}
                </div>
                <div class="text-xs text-slate-500">Waiting for acceptance</div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  v-if="config?.rejectSupportRequestAction"
                  class="rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-60"
                  type="button"
                  :disabled="!config?.rejectSupportRequestAction"
                  @click="rejectSupport(String(r?.requestId ?? r?.id ?? ''))"
                >
                  Reject
                </button>
                <button
                  class="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  type="button"
                  :disabled="!config?.acceptSupportRequestAction"
                  @click="acceptSupport(String(r?.requestId ?? r?.id ?? ''))"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!activeRoomId" class="flex flex-col gap-2">
          <button
            v-if="!isAdmin"
            class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            type="button"
            :disabled="chatStatus === 'connecting' || chatStatus === 'starting' || isWaitingForAdmin"
            @click="startChat"
          >
            {{
              chatStatus === 'connecting' || chatStatus === 'starting'
                ? 'Starting...'
                : isWaitingForAdmin
                  ? 'Waiting for Admin...'
                  : 'Start a Chat'
            }}
          </button>
          <div
            v-if="isAdmin && supportRequests.length === 0 && chatStatus === 'connected'"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-600"
          >
            When a patient clicks <span class="font-semibold">Start a Chat</span>, their request appears here with
            <span class="font-semibold">Accept</span>. You do not need to click Start a Chat first.
          </div>
          <div class="text-xs text-slate-500">
            You’ll be connected to support. Please don’t share passwords or sensitive info.
          </div>
          <div v-if="pendingMessages.length > 0" class="rounded-xl border border-slate-200 bg-white p-3">
            <div class="mb-2 text-xs font-semibold text-slate-600">Queued messages (will send after admin accepts)</div>
            <div class="flex flex-col gap-1.5">
              <div
                v-for="m in pendingMessages"
                :key="String(m?.clientMessageId ?? Math.random())"
                class="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-700"
              >
                {{ String(m?.body ?? '') }}
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div v-if="activeMessages.length === 0" class="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
            Say hi—support will respond here.
          </div>

          <div
            v-for="m in activeMessages"
            :key="messageKey(m)"
            class="flex min-w-0"
          >
            <div
              class="flex w-full min-w-0"
              :class="isMine(m) ? 'justify-end' : 'justify-start'"
            >
              <div class="min-w-0 max-w-[85%]">
                <div
                  class="inline-flex w-full min-w-0 flex-col gap-1 overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm shadow-sm"
                  :class="
                    isMine(m)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-slate-900 border border-slate-200'
                  "
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0 truncate text-[11px] font-semibold opacity-80">
                      {{ resolveSenderLabel(m) }}
                      <span v-if="m?.status === 'pending'" class="font-normal"> · sending…</span>
                    </div>
                    <div v-if="formatTime(m)" class="text-[11px] opacity-70">{{ formatTime(m) }}</div>
                  </div>
                  <div class="whitespace-pre-wrap break-words leading-relaxed">{{ m?.body }}</div>
                  <div
                    v-if="isMine(m) && activeInlineEditKey === messageKey(m)"
                    class="mt-2 rounded-xl border border-emerald-200 bg-white p-3 text-slate-900 shadow-sm"
                  >
                    <div class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Edit message
                    </div>
                    <input
                      v-model="inlineEditText"
                      type="text"
                      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                      placeholder="Edit message"
                      @keydown.enter.prevent="sendInlineEdit(m)"
                    />
                    <div class="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        class="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        :disabled="!canSendNow || !inlineEditText.trim()"
                        @click="sendInlineEdit(m)"
                      >
                        Send now
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        @click="cancelInlineEdit"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div
                    v-if="isMine(m) && m?.status !== 'pending' && activeInlineEditKey !== messageKey(m)"
                    class="mt-1 flex items-center gap-2"
                  >
                    <button
                      type="button"
                      class="rounded-full border border-emerald-300 bg-white/15 px-3 py-1 text-xs font-semibold text-white hover:bg-white/25"
                      @click="editMessage(m)"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-3">
        <div class="flex items-center gap-2">
          <input
            v-model="draft"
            class="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            type="text"
            :disabled="!canSendNow"
            placeholder="Type a message…"
            @keydown.enter.prevent="send"
          />
          <button
            class="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            type="button"
            :disabled="!canSendNow"
            @click="send"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

