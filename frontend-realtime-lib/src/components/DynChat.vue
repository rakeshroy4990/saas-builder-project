<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { LOCALE_CONFIG } from '@saas-builder/i18n-contract';
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
  editMessageAction?: ActionConfig;
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

const { t, locale } = useI18n();

const packageName = computed(() => props.config?.packageName ?? 'hospital');
const storeKey = computed(() => props.config?.storeKey ?? 'Chat');
const appStore = useAppStore();

const chat = computed(() => (appStore.getData(packageName.value, storeKey.value) ?? {}) as Record<string, unknown>);
const smartAiEnabled = computed(() => Boolean(props.config?.enableSmartAi));
const chatStatus = computed(() => String(chat.value.status ?? '').trim());
const isWaitingForAdmin = computed(() => chatStatus.value === 'waiting_for_admin');
const activeRoomId = computed(() => String(chat.value.activeRoomId ?? '').trim());
const messagesByRoomId = computed(() => (chat.value.messagesByRoomId ?? {}) as Record<string, unknown>);
const pendingMessages = computed(() => {
  const arr = (chat.value.pendingMessages ?? []) as unknown;
  return Array.isArray(arr) ? (arr as any[]) : [];
});
const typedPendingMessages = computed(() =>
  pendingMessages.value.filter((m) => String(m?.body ?? '').trim().length > 0)
);
const supportRequests = computed(() => {
  const arr = (chat.value.supportRequests ?? []) as unknown;
  return Array.isArray(arr) ? (arr as any[]) : [];
});
const authSession = computed(() => (appStore.getData(packageName.value, 'AuthSession') ?? {}) as Record<string, unknown>);
const myUserId = computed(() => String(authSession.value.userId ?? '').trim());
const myRole = computed(() => String(authSession.value.role ?? '').trim().toUpperCase());
const isAdmin = computed(() => myRole.value === 'ADMIN');
const chatMode = computed(() => {
  const stored = String(chat.value.mode ?? '').trim().toLowerCase();
  if (stored) return stored;
  if (!smartAiEnabled.value) return 'human';
  const rid = String(chat.value.activeRoomId ?? '').trim();
  if (rid && rid !== 'smart-ai') return 'human';
  const humanRoomId = String(chat.value.humanActiveRoomId ?? '').trim();
  if (humanRoomId) return 'human';
  const status = String(chat.value.status ?? '').trim();
  if (status === 'waiting_for_admin' || status === 'starting' || status === 'connecting') return 'human';
  const reqs = chat.value.supportRequests;
  if (isAdmin.value && Array.isArray(reqs) && reqs.length > 0) return 'human';
  return 'smart_ai';
});
const smartAiMode = computed(() => smartAiEnabled.value && chatMode.value === 'smart_ai');
const myDisplayName = computed(() => {
  const fullName = String(authSession.value.fullName ?? '').trim();
  if (fullName) return fullName;
  const display = String(authSession.value.userDisplayName ?? '').trim();
  if (display) return display;
  const email = String(authSession.value.email ?? '').trim();
  if (email) return email;
  return t('chat.widget.me');
});
const aiDisclaimerVisible = computed(() => Boolean(chat.value.aiDisclaimerVisible));
const aiProcessing = computed(() => Boolean(chat.value.aiProcessing));
const smartAiQuickPrompts = computed(() => {
  void locale.value;
  return [
    t('chat.widget.quickPrompts.fever'),
    t('chat.widget.quickPrompts.coldCough'),
    t('chat.widget.quickPrompts.stomachPain'),
    t('chat.widget.quickPrompts.childCough')
  ];
});

const messageFontStyle = (m: Record<string, unknown>): Record<string, string> => {
  const lang = String(m?.detectedLocale ?? '').trim().toLowerCase();
  if (lang === 'kn') return { fontFamily: "'Noto Sans Kannada', sans-serif" };
  if (lang === 'hi') return { fontFamily: "'Noto Sans Devanagari', sans-serif" };
  return {};
};

const localeBadgeLabel = (m: Record<string, unknown>): string => {
  const lang = String(m?.detectedLocale ?? '').trim().toLowerCase();
  if (lang === 'kn') return LOCALE_CONFIG.kn.label;
  if (lang === 'hi') return LOCALE_CONFIG.hi.label;
  return '';
};

const toggleEnglishTranslation = (m: Record<string, unknown>) => {
  const key = messageKey(m);
  const rid = activeRoomId.value || 'smart-ai';
  const byRoom = { ...(messagesByRoomId.value ?? {}) } as Record<string, unknown>;
  const rows = Array.isArray(byRoom[rid]) ? [...(byRoom[rid] as unknown[])] : [];
  const next = rows.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    if (messageKey(row) !== key) return raw;
    return { ...row, showEnglishTranslation: !Boolean(row.showEnglishTranslation) };
  });
  appStore.setData(packageName.value, storeKey.value, {
    ...chat.value,
    messagesByRoomId: { ...byRoom, [rid]: next }
  });
};

const composerFontStyle = computed((): Record<string, string> => {
  const code = String(locale.value ?? 'en').trim().toLowerCase();
  if (code === 'kn') return { fontFamily: "'Noto Sans Kannada', sans-serif" };
  if (code === 'hi') return { fontFamily: "'Noto Sans Devanagari', sans-serif" };
  return {};
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
  if (senderId.toLowerCase() === 'ai') return t('chat.title');
  if (senderId === 'me') return myDisplayName.value;
  if (myUserId.value && senderId === myUserId.value) return myDisplayName.value;
  if (senderId === (props.config?.supportUserId ?? 'support')) return t('chat.widget.support');
  if (looksLikeMongoId(senderId)) return isAdmin.value ? t('chat.widget.patient') : t('chat.widget.support');
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
const inlineEditInputEl = ref<HTMLInputElement | null>(null);
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
const editingMessage = ref<any | null>(null);
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
  if (activeInlineEditKey.value) {
    await commitInlineEdit();
    return;
  }
  await sendBody(draft.value.trim());
};

const sendBody = async (body: string) => {
  const rid = activeRoomId.value;
  if (!body) return;
  if (smartAiMode.value && aiDisclaimerVisible.value) return;
  if (!smartAiMode.value && !rid && !isWaitingForAdmin.value && chatStatus.value !== 'starting' && chatStatus.value !== 'connecting') return;
  cancelInlineEdit();
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

const composerText = computed({
  get: () => (activeInlineEditKey.value ? inlineEditText.value : draft.value),
  set: (value: string) => {
    if (activeInlineEditKey.value) inlineEditText.value = value;
    else draft.value = value;
  }
});

const canSubmitComposer = computed(() => {
  if (!canSendNow.value) return false;
  const text = activeInlineEditKey.value ? inlineEditText.value.trim() : draft.value.trim();
  return text.length > 0;
});

const messageKey = (m: any): string => {
  const messageId = String(m?.messageId ?? m?.id ?? m?.Id ?? '').trim();
  if (messageId) return messageId;
  const clientMessageId = String(m?.clientMessageId ?? '').trim();
  if (clientMessageId) return clientMessageId;
  return `${String(m?.senderId ?? '').trim()}-${String(m?.createdTimestamp ?? '').trim()}`;
};

const isEditingMessage = (m: any): boolean =>
  Boolean(activeInlineEditKey.value) && activeInlineEditKey.value === messageKey(m);

const humanMessageBubbleClass = 'bg-white text-slate-900 border border-slate-200';

const messageBubbleClass = (m: any): string => {
  if (!smartAiMode.value) return humanMessageBubbleClass;
  return isMine(m) ? 'bg-emerald-600 text-white' : humanMessageBubbleClass;
};

const editIconButtonClass = (m: any): string =>
  smartAiMode.value && isMine(m)
    ? 'text-white/90 hover:bg-white/20 focus:ring-white/60'
    : 'text-slate-500 hover:bg-slate-100 focus:ring-slate-200';

const canEditMessage = (m: any): boolean => {
  if (smartAiMode.value || !isMine(m)) return false;
  const body = String(m?.body ?? '').trim();
  return body.length > 0;
};

const editMessage = (m: any) => {
  const body = String(m?.body ?? '').trim();
  if (!body) return;
  editingMessage.value = m;
  activeInlineEditKey.value = messageKey(m);
  inlineEditText.value = body;
  void nextTick(() => inlineEditInputEl.value?.focus());
};

const resendMessage = (m: any) => {
  if (!canSendNow.value) return;
  const body = String(m?.body ?? '').trim();
  if (!body) return;
  if (smartAiMode.value && props.config?.aiSendMessageAction) {
    emit('action', {
      action: props.config.aiSendMessageAction,
      payload: { roomId: 'smart-ai', body, clientMessageId: crypto.randomUUID() }
    });
    return;
  }
  emit('action', {
    action: props.config?.sendMessageAction,
    payload: { roomId: activeRoomId.value, body, clientMessageId: crypto.randomUUID() }
  });
};

const cancelInlineEdit = () => {
  activeInlineEditKey.value = '';
  inlineEditText.value = '';
  editingMessage.value = null;
};

const commitInlineEdit = async () => {
  if (!canSendNow.value || !activeInlineEditKey.value || !editingMessage.value) return;
  const body = inlineEditText.value.trim();
  if (!body) return;
  const m = editingMessage.value;
  const original = String(m?.body ?? '').trim();
  if (body === original) {
    cancelInlineEdit();
    return;
  }
  const editAction = props.config?.editMessageAction ?? props.config?.sendMessageAction;
  if (!editAction) return;
  const clientMessageId = String(m?.clientMessageId ?? '').trim();
  const messageId = String(m?.messageId ?? m?.id ?? m?.Id ?? '').trim();
  emit('action', {
    action: editAction,
    payload: {
      roomId: activeRoomId.value,
      body,
      clientMessageId: clientMessageId || undefined,
      messageId: messageId || undefined,
      messageKey: messageKey(m)
    }
  });
  cancelInlineEdit();
};

const sendInlineEdit = async () => {
  await commitInlineEdit();
};
</script>

<template>
  <div :id="htmlId" :class="rootClass">
    <div :class="shellClass">
      <div
        v-if="smartAiEnabled"
        class="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      >
        <div class="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-center">
          <div
            class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-1"
            role="tablist"
            :aria-label="t('chat.widget.mode.smartAi')"
          >
            <button
              type="button"
              role="tab"
              :aria-selected="smartAiMode"
              class="rounded-full px-4 py-1.5 text-xs font-semibold transition-colors"
              :class="
                smartAiMode
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/90'
              "
              @click="setChatMode('smart_ai')"
            >
              {{ t('chat.widget.mode.smartAi') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="!smartAiMode"
              class="rounded-full px-4 py-1.5 text-xs font-semibold transition-colors"
              :class="
                !smartAiMode
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/90'
              "
              @click="setChatMode('human')"
            >
              {{ t('chat.widget.mode.humanSupport') }}
            </button>
          </div>
        </div>
      </div>
      <div
        ref="messagesScrollEl"
        class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain bg-slate-50/50 p-4 sm:p-5 [-webkit-overflow-scrolling:touch]"
      >
        <div v-if="smartAiEnabled" class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div class="text-xs leading-relaxed text-slate-600">
            <span class="font-semibold text-emerald-800">{{ t('chat.title') }}</span>
            <span class="ml-1.5">{{ t('chat.widget.generalGuidance') }}</span>
          </div>
        </div>

        <div v-if="smartAiMode && aiDisclaimerVisible" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div class="text-xs font-semibold text-amber-900">{{ t('chat.widget.safetyNoticeTitle') }}</div>
          <p class="mt-2 text-xs leading-relaxed text-amber-800">
            {{ t('chat.widget.safetyNoticeBody') }}
          </p>
          <button
            type="button"
            class="mt-3 rounded-full border border-amber-300 bg-white px-4 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            @click="emit('action', { action: config?.aiDismissDisclaimerAction, payload: {} })"
          >
            {{ t('chat.widget.iUnderstand') }}
          </button>
        </div>
        <div
          v-if="smartAiMode && aiProcessing"
          class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900"
        >
          {{ t('chat.widget.processingRequest') }}
        </div>

        <div v-if="isAdmin && supportRequests.length > 0" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <div class="text-sm font-semibold text-amber-900">{{ t('chat.widget.incomingRequestTitle') }}</div>
          <div class="mt-1 text-xs text-amber-800">{{ t('chat.widget.incomingRequestSubtitle') }}</div>
          <div class="mt-3 flex flex-col gap-2">
            <div
              v-for="r in supportRequests"
              :key="String(r?.requestId ?? r?.id ?? r?.requesterUserId ?? '')"
              class="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
            >
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-slate-900">
                  {{ String(r?.requesterDisplayName ?? r?.requesterUserId ?? t('chat.widget.patient')) }}
                </div>
                <div class="text-xs text-slate-500">{{ t('chat.widget.waitingAcceptance') }}</div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  v-if="config?.rejectSupportRequestAction"
                  class="rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-60"
                  type="button"
                  :disabled="!config?.rejectSupportRequestAction"
                  @click="rejectSupport(String(r?.requestId ?? r?.id ?? ''))"
                >
                  {{ t('chat.widget.reject') }}
                </button>
                <button
                  class="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  type="button"
                  :disabled="!config?.acceptSupportRequestAction"
                  @click="acceptSupport(String(r?.requestId ?? r?.id ?? ''))"
                >
                  {{ t('chat.widget.accept') }}
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
                ? t('chat.widget.starting')
                : isWaitingForAdmin
                  ? t('chat.widget.waitingAdmin')
                  : t('chat.widget.startChat')
            }}
          </button>
          <div
            v-if="isAdmin && supportRequests.length === 0 && chatStatus === 'connected'"
            class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-600"
          >
            {{ t('chat.widget.adminHintPrefix') }} <span class="font-semibold">{{ t('chat.widget.startChat') }}</span>,
            {{ t('chat.widget.adminHintMiddle') }} <span class="font-semibold">{{ t('chat.widget.accept') }}</span>.
            {{ t('chat.widget.adminHintSuffix') }}
          </div>
          <div class="text-xs text-slate-500">
            {{ t('chat.widget.supportWarning') }}
          </div>
          <div v-if="!smartAiMode && typedPendingMessages.length > 0" class="flex flex-col gap-2">
            <div
              v-for="m in typedPendingMessages"
              :key="String(m?.clientMessageId ?? `${m?.createdTimestamp ?? ''}-${m?.body ?? ''}`)"
              class="flex min-w-0 justify-end"
            >
              <div class="min-w-0 max-w-[85%]">
                <div
                  class="inline-flex w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-2xl px-4 py-3 text-sm shadow-sm"
                  :class="humanMessageBubbleClass"
                >
                  <div class="truncate text-[11px] font-semibold opacity-80">
                    {{ myDisplayName }}
                  </div>
                  <div class="whitespace-pre-wrap break-words leading-relaxed">
                    {{ String(m?.body ?? '').trim() }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div v-if="activeMessages.length === 0" class="rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm leading-relaxed text-slate-600">
            {{ t('chat.widget.sayHi') }}
          </div>
          <div
            v-if="smartAiMode && !aiDisclaimerVisible && !aiProcessing"
            class="flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3"
          >
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[0])"
            >
              {{ t('chat.widget.quickPills.fever') }}
            </button>
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[1])"
            >
              {{ t('chat.widget.quickPills.coldCough') }}
            </button>
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[2])"
            >
              {{ t('chat.widget.quickPills.stomachPain') }}
            </button>
            <button
              type="button"
              class="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSendNow"
              @click="sendSmartAiQuickPrompt(smartAiQuickPrompts[3])"
            >
              {{ t('chat.widget.quickPills.childCough') }}
            </button>
          </div>

          <div
            v-for="m in activeMessages"
            :key="messageKey(m)"
            class="flex min-w-0"
          >
            <div
              class="flex w-full min-w-0 items-start gap-2"
              :class="isMine(m) ? 'justify-end' : 'justify-start'"
            >
              <div class="min-w-0 max-w-[85%]">
                <div
                  class="inline-flex w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-2xl px-4 py-3 text-sm shadow-sm"
                  :class="messageBubbleClass(m)"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0 truncate text-[11px] font-semibold opacity-80">
                      {{ resolveSenderLabel(m) }}
                      <span v-if="m?.status === 'pending'" class="font-normal"> · {{ t('chat.widget.sending') }}</span>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <button
                        v-if="canEditMessage(m) && !isEditingMessage(m)"
                        type="button"
                        class="inline-flex h-6 w-6 items-center justify-center rounded-full transition focus:outline-none focus:ring-2"
                        :class="editIconButtonClass(m)"
                        :title="t('chat.widget.edit')"
                        :aria-label="t('chat.widget.editAria')"
                        @click="editMessage(m)"
                      >
                        <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                          <path d="M12 20h9" stroke-linecap="round" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linejoin="round" />
                        </svg>
                      </button>
                      <div v-if="formatTime(m)" class="text-[11px] opacity-70">{{ formatTime(m) }}</div>
                    </div>
                  </div>
                  <input
                    v-if="isEditingMessage(m)"
                    :ref="(el) => { if (isEditingMessage(m)) inlineEditInputEl = el as HTMLInputElement | null }"
                    v-model="inlineEditText"
                    type="text"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    :placeholder="t('chat.widget.message')"
                    @keydown.enter.prevent="sendInlineEdit"
                    @keydown.escape.prevent="cancelInlineEdit"
                  />
                  <div v-else class="whitespace-pre-wrap break-words leading-relaxed" :style="messageFontStyle(m)">
                    <span
                      v-if="localeBadgeLabel(m)"
                      class="mb-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800"
                    >
                      {{ localeBadgeLabel(m) }}
                    </span>
                    <div>
                      {{
                        m?.showEnglishTranslation && m?.answerEnglish
                          ? m.answerEnglish
                          : parseAiMessageBody(m?.body).text || m?.body
                      }}
                    </div>
                  </div>
                  <button
                    v-if="m?.showTranslationToggle && m?.answerEnglish"
                    type="button"
                    class="mt-1 text-left text-xs font-semibold text-slate-600 underline"
                    @click="toggleEnglishTranslation(m)"
                  >
                    {{ t('chat.widget.seeInEnglish') }}
                  </button>
                  <a
                    v-if="m?.emergencyCall108"
                    href="tel:108"
                    class="mt-2 inline-flex rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {{ t('chat.widget.call108') }}
                  </a>
                  <div
                    v-if="smartAiMode && !isMine(m) && parseAiMessageBody(m?.body).options.length > 0"
                    class="mt-2 flex flex-wrap gap-2"
                  >
                    <button
                      v-for="option in parseAiMessageBody(m?.body).options"
                      :key="`${messageKey(m)}-${option}`"
                      type="button"
                      class="rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="!canSendNow || aiProcessing"
                      @click="sendQuickOption(option)"
                    >
                      {{ option }}
                    </button>
                  </div>
                </div>
              </div>
              <button
                v-if="smartAiMode && isMine(m) && m?.sendFailedTimeout"
                type="button"
                class="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canSendNow"
                :title="t('chat.widget.resend')"
                :aria-label="t('chat.widget.resendAria')"
                @click="resendMessage(m)"
              >
                <span class="text-lg font-bold leading-none" aria-hidden="true">↻</span>
              </button>
            </div>
          </div>

          <div
            v-if="smartAiMode && aiProcessing"
            class="flex min-w-0 justify-start"
            aria-live="polite"
            :aria-label="t('chat.widget.assistantTyping')"
          >
            <div class="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div class="mb-1 text-[11px] font-semibold text-slate-500">{{ t('chat.title') }}</div>
              <div class="text-sm font-semibold tracking-[0.15em] text-black">{{ processingDots }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:pb-3">
        <div
          v-if="smartAiMode && aiProcessing"
          class="mb-2.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5"
          aria-live="polite"
          :aria-label="t('chat.widget.assistantProcessing')"
        >
          <span class="text-xs font-medium text-slate-800">{{ t('chat.widget.assistantTyping') }}</span>
          <span class="ml-1 min-w-[1.75rem] text-sm font-semibold tracking-[0.15em] text-black">{{ processingDots }}</span>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="composerText"
            class="flex-1 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            :style="composerFontStyle"
            type="text"
            :disabled="!canSendNow"
            :placeholder="
              activeInlineEditKey
                ? t('chat.widget.editAndSend')
                : smartAiMode
                  ? aiDisclaimerVisible
                    ? t('chat.widget.clickUnderstand')
                    : aiProcessing
                      ? t('chat.widget.processingRequest')
                      : t('chat.widget.tellSymptoms')
                  : t('chat.widget.typeMessage')
            "
            @keydown.enter.prevent="send"
          />
          <button
            class="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            type="button"
            :disabled="!canSubmitComposer"
            @click="send"
          >
            {{ t('chat.widget.send') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

