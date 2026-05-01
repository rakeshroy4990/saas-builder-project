<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
  enableSmartAi?: boolean;
  setModeAction?: ActionConfig;
  aiStartChatAction?: ActionConfig;
  aiSendMessageAction?: ActionConfig;
  aiShowDisclaimerAction?: ActionConfig;
  aiDismissDisclaimerAction?: ActionConfig;
  termsUrl?: string;
  styles?: { utilityClasses?: string };
};

const props = defineProps<{ config?: DynChatConfig; htmlId?: string }>();
const emit = defineEmits<{ action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }] }>();

const packageName = computed(() => props.config?.packageName ?? 'hospital');
const storeKey = computed(() => props.config?.storeKey ?? 'Chat');
const appStore = useAppStore();

const chat = computed(() => (appStore.getData(packageName.value, storeKey.value) ?? {}) as Record<string, unknown>);
const chatMode = computed(() => String(chat.value.mode ?? (props.config?.enableSmartAi ? 'smart_ai' : 'human')).trim().toLowerCase());
const smartAiEnabled = computed(() => Boolean(props.config?.enableSmartAi));
const smartAiMode = computed(() => smartAiEnabled.value && chatMode.value === 'smart_ai');
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
const aiDisclaimerVisible = computed(() => Boolean(chat.value.aiDisclaimerVisible));
const aiProcessing = computed(() => Boolean(chat.value.aiProcessing));
const smartAiQuickPrompts = [
  'I have fever for 2 days',
  'I have cold and cough',
  'I have stomach pain after eating',
  'My child has cough'
];

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
  if (senderId.toLowerCase() === 'ai') return 'Health Assistant';
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

type ParsedAiBody = { text: string; options: string[] };

const OPTION_SPLIT_REGEX = /(?:\r?\n)+/g;
const OPTION_PREFIX_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+/;
const NON_OPTION_TEXT_REGEX =
  /^(?:i am not a doctor\b|this is general guidance only\b|for emergencies\b|terms of use\b|please consult\b)/i;

function parseAiMessageBody(rawValue: unknown): ParsedAiBody {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return { text: '', options: [] };
  const markerRegex = /\bnext options\s*:/i;
  const markerMatch = markerRegex.exec(raw);
  if (!markerMatch) return { text: raw, options: [] };

  const markerStart = markerMatch.index;
  const markerEnd = markerStart + markerMatch[0].length;
  const before = raw.slice(0, markerStart).trim();
  const after = raw.slice(markerEnd).trim();
  if (!after) return { text: before || raw, options: [] };

  const seen = new Set<string>();
  const options = after
    .split(OPTION_SPLIT_REGEX)
    .map((line) => {
      const source = String(line ?? '');
      const isPrefixedOption = OPTION_PREFIX_REGEX.test(source);
      const cleaned = source.replace(/^[-*•\d.)\s]+/, '').trim();
      return { cleaned, isPrefixedOption };
    })
    .filter((line) => {
      if (!line.cleaned) return false;
      if (!line.isPrefixedOption) return false;
      if (NON_OPTION_TEXT_REGEX.test(line.cleaned)) return false;
      const lowered = line.cleaned.toLowerCase();
      if (seen.has(lowered)) return false;
      seen.add(lowered);
      return true;
    })
    .map((line) => line.cleaned)
    .slice(0, 6);

  if (options.length === 0) return { text: raw, options: [] };
  return { text: before, options };
}

const activeMessages = computed(() => {
  const rid = activeRoomId.value;
  if (!rid) return [];
  const arr = messagesByRoomId.value[rid];
  return Array.isArray(arr) ? (arr as any[]) : [];
});

const draft = ref('');
const messagesScrollEl = ref<HTMLElement | null>(null);
const processingDots = ref('.');
let processingDotsTimer: ReturnType<typeof setInterval> | null = null;

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

watch(
  aiProcessing,
  (isProcessing) => {
    if (processingDotsTimer) {
      clearInterval(processingDotsTimer);
      processingDotsTimer = null;
    }
    if (!isProcessing) {
      processingDots.value = '.';
      return;
    }
    const sequence = ['.', '..', '...'];
    let idx = 0;
    processingDots.value = sequence[idx];
    processingDotsTimer = setInterval(() => {
      idx = (idx + 1) % sequence.length;
      processingDots.value = sequence[idx];
    }, 350);
  },
  { immediate: true }
);

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
  if (smartAiMode.value && props.config?.aiStartChatAction) {
    emit('action', { action: props.config.aiStartChatAction, payload: {} });
    return;
  }
  emit('action', {
    action: props.config?.startChatAction,
    payload: { otherUserId: props.config?.supportUserId ?? 'support' }
  });
};

const setChatMode = (mode: 'human' | 'smart_ai') => {
  emit('action', { action: props.config?.setModeAction, payload: { mode } });
  if (mode === 'smart_ai') {
    emit('action', { action: props.config?.aiShowDisclaimerAction, payload: {} });
    if (!activeRoomId.value && props.config?.aiStartChatAction) {
      emit('action', { action: props.config.aiStartChatAction, payload: {} });
    }
  }
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
  if (smartAiMode.value && props.config?.aiShowDisclaimerAction) {
    emit('action', { action: props.config.aiShowDisclaimerAction, payload: {} });
  }
  if (smartAiMode.value && !activeRoomId.value && props.config?.aiStartChatAction) {
    emit('action', { action: props.config.aiStartChatAction, payload: {} });
  }
  if (!autoStartEnabled.value) return;
  if (!props.config?.startChatAction) return;
  if (activeRoomId.value) return;
  if (didAutoStart) return;
  didAutoStart = true;
  startChat();
});

onBeforeUnmount(() => {
  if (processingDotsTimer) {
    clearInterval(processingDotsTimer);
    processingDotsTimer = null;
  }
});

const send = async () => {
  await sendBody(draft.value.trim());
};

const sendBody = async (body: string) => {
  const rid = activeRoomId.value;
  if (!body) return;
  if (smartAiMode.value && aiDisclaimerVisible.value) return;
  if (!smartAiMode.value && !rid && !isWaitingForAdmin.value && chatStatus.value !== 'starting' && chatStatus.value !== 'connecting') return;
  draft.value = '';
  if (smartAiMode.value && props.config?.aiSendMessageAction) {
    emit('action', {
      action: props.config.aiSendMessageAction,
      payload: { roomId: rid || 'smart-ai', body, clientMessageId: crypto.randomUUID() }
    });
    return;
  }
  emit('action', {
    action: props.config?.sendMessageAction,
    payload: { roomId: rid, body, clientMessageId: crypto.randomUUID() }
  });
};

const sendQuickOption = async (option: string) => {
  if (!smartAiMode.value || aiProcessing.value) return;
  await sendBody(String(option ?? '').trim());
};

const sendSmartAiQuickPrompt = async (prompt: string) => {
  if (!smartAiMode.value || aiProcessing.value) return;
  await sendBody(String(prompt ?? '').trim());
};

const canSendNow = computed(() => {
  if (smartAiMode.value) {
    return !aiDisclaimerVisible.value && !aiProcessing.value;
  }
  return (
    Boolean(activeRoomId.value) ||
    isWaitingForAdmin.value ||
    chatStatus.value === 'starting' ||
    chatStatus.value === 'connecting'
  );
});

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
        v-if="smartAiEnabled"
        class="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/85 sm:px-4"
      >
        <div class="flex items-center justify-end">
          <div class="flex items-center gap-1 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              class="rounded-full px-3 py-1 text-xs font-semibold"
              :class="smartAiMode ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-200'"
              @click="setChatMode('smart_ai')"
            >
              Smart AI
            </button>
            <button
              type="button"
              class="rounded-full px-3 py-1 text-xs font-semibold"
              :class="!smartAiMode ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200'"
              @click="setChatMode('human')"
            >
              Human Support
            </button>
          </div>
        </div>
      </div>
      <div
        ref="messagesScrollEl"
        class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain bg-slate-50/50 p-3 sm:p-4 [-webkit-overflow-scrolling:touch]"
      >
        <div v-if="smartAiEnabled" class="rounded-2xl border border-slate-200 bg-white p-3">
          <div class="text-[11px] text-slate-600">
            <span class="font-semibold text-indigo-700">Health Assistant</span>
            <span class="ml-1">General health guidance only</span>
          </div>
        </div>

        <div v-if="smartAiMode && aiDisclaimerVisible" class="rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <div class="text-xs font-semibold text-amber-900">Safety notice</div>
          <p class="mt-1 text-xs leading-relaxed text-amber-800">
            This is general guidance, not medical diagnosis. For emergencies, contact your nearest emergency service immediately.
          </p>
          <button
            type="button"
            class="mt-2 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            @click="emit('action', { action: config?.aiDismissDisclaimerAction, payload: {} })"
          >
            I understand
          </button>
        </div>
        <div
          v-if="smartAiMode && aiProcessing"
          class="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800"
        >
          Health Assistant is processing your request...
        </div>

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
            v-if="!isAdmin && !smartAiMode"
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
            v-if="smartAiMode && !aiDisclaimerVisible && !aiProcessing"
            class="flex flex-wrap gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3"
          >
            <button
              type="button"
              class="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[0])"
            >
              Fever 🤒
            </button>
            <button
              type="button"
              class="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[1])"
            >
              Cold &amp; cough 🤧
            </button>
            <button
              type="button"
              class="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[2])"
            >
              Stomach pain 🤢
            </button>
            <button
              type="button"
              class="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[3])"
            >
              Child Cough 👶
            </button>
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
                  <div class="whitespace-pre-wrap break-words leading-relaxed">
                    {{ parseAiMessageBody(m?.body).text || m?.body }}
                  </div>
                  <div
                    v-if="smartAiMode && !isMine(m) && parseAiMessageBody(m?.body).options.length > 0"
                    class="mt-2 flex flex-wrap gap-2"
                  >
                    <button
                      v-for="option in parseAiMessageBody(m?.body).options"
                      :key="`${messageKey(m)}-${option}`"
                      type="button"
                      class="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="!canSendNow || aiProcessing"
                      @click="sendQuickOption(option)"
                    >
                      {{ option }}
                    </button>
                  </div>
                  <div
                    v-if="!smartAiMode && isMine(m) && activeInlineEditKey === messageKey(m)"
                    class="mt-2 rounded-lg border border-white/40 bg-white/10 p-2 text-white"
                  >
                    <input
                      v-model="inlineEditText"
                      type="text"
                      class="w-full rounded-md border border-white/70 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-300"
                      placeholder="Message"
                      @keydown.enter.prevent="sendInlineEdit(m)"
                    />
                    <div class="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        class="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-white disabled:opacity-50"
                        :disabled="!canSendNow || !inlineEditText.trim()"
                        @click="sendInlineEdit(m)"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        class="rounded-full border border-white/80 bg-transparent px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
                        @click="cancelInlineEdit"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div
                    v-if="!smartAiMode && isMine(m) && m?.status !== 'pending' && activeInlineEditKey !== messageKey(m)"
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

          <div
            v-if="smartAiMode && aiProcessing"
            class="flex min-w-0 justify-start"
            aria-live="polite"
            aria-label="Health Assistant is typing"
          >
            <div class="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
              <div class="mb-1 text-[11px] font-semibold text-slate-500">Health Assistant</div>
              <div class="text-sm font-semibold tracking-[0.15em] text-black">{{ processingDots }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-3">
        <div
          v-if="smartAiMode && aiProcessing"
          class="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          aria-live="polite"
          aria-label="Health Assistant is processing"
        >
          <span class="text-xs font-medium text-slate-800">Health Assistant is typing</span>
          <span class="ml-1 min-w-[1.75rem] text-sm font-semibold tracking-[0.15em] text-black">{{ processingDots }}</span>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="draft"
            class="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            type="text"
            :disabled="!canSendNow"
            :placeholder="
              smartAiMode
                ? aiDisclaimerVisible
                  ? 'Please click I understand to continue...'
                  : aiProcessing
                    ? 'Processing your request...'
                  : 'Tell Health Assistant your symptoms...'
                : 'Type a message…'
            "
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

