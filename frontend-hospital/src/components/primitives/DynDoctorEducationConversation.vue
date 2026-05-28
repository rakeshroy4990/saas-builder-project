<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useAppStore } from '../../store/useAppStore';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import {
  postEducationPrescriptionTranscribe,
  isPrescriptionFullyNotStated,
  buildPrescriptionQuestionDraft
} from '../../services/http/educationPrescriptionTranscribe';
import {
  assistantDisplayBody,
  assistantDisplayFollowUps
} from '../../services/domain/hospital/education/educationAssistantPayload';
import {
  buildEducationAttachmentDisplayContent,
  buildEducationRetrievalQuestionWithAttachments,
  normalizeEducationClinicalAttachments,
  stripEducationAttachedFileHeaders,
  type EducationClinicalAttachment
} from '../../services/domain/hospital/education/educationClinicalAttachments';
import { resolveStyle } from '../../core/engine/StyleResolver';
import DynDoctorEducationPrescriptionSimilarity from './DynDoctorEducationPrescriptionSimilarity.vue';

type QueryTab = 'books' | 'prescription';
type ConversationFigure = {
  imgIndex: number;
  page: number;
  ext: string;
  caption: string;
  imageData: string;
  url: string;
  sourceFile: string;
};

type ConversationReference = {
  bookName: string;
  page: number;
};

type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  loading?: boolean;
  error?: string;
  source?: string;
  chunksUsed?: number;
  followUpQuestions?: string[];
  images?: ConversationFigure[];
  reference?: ConversationReference[];
  /** After a failed request, resend button uses stronger styling until the next send. */
  sendFailedTimeout?: boolean;
  retrievalQuestion?: string;
  autoAttachmentPrompt?: boolean;
  submittedQuestion?: string;
};

type ConversationSession = {
  id: string;
  title: string;
  bookName?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { execute } = useActionEngine(props.pageConfig);
const { t } = useI18n();
const appStore = useAppStore(pinia);
const toastStore = useToastStore(pinia);
const threadRef = ref<HTMLElement | null>(null);
const questionTextareaRef = ref<HTMLTextAreaElement | null>(null);
function questionTextareaMaxHeightPx(): number {
  if (typeof window === 'undefined') return 30 * 16;
  return Math.min(window.innerHeight * 0.52, 30 * 16);
}
const fileInputRef = ref<HTMLInputElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
const prescriptionReading = ref(false);
const showPrescriptionCameraModal = ref(false);
const cameraStream = ref<MediaStream | null>(null);
const cameraVideoRef = ref<HTMLVideoElement | null>(null);
const cameraPreviewReady = ref(false);
const showConversationControls = ref(false);
const showQuickStarts = ref(true);
const showSavedThreads = ref(false);
const PANEL_PREFS_KEY = 'hospital.doctorEducationConversation.panelPrefs.v1';
const hasLoadedPanelPrefs = ref(false);
const queryTab = ref<QueryTab>('books');
const MAX_CONVERSATION_ATTACHMENTS = 3;
const showAutoSentNotice = ref(false);
let autoSentNoticeTimer: ReturnType<typeof setTimeout> | null = null;
const lastSequenceSendToken = ref('');

function readClinicalAttachments(): EducationClinicalAttachment[] {
  return normalizeEducationClinicalAttachments(education.value.clinicalAttachments);
}

function writeClinicalAttachments(rows: EducationClinicalAttachment[]): void {
  const prev = (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'DoctorEducationUiState', {
    ...prev,
    clinicalAttachments: rows
  });
}

const attachedClinicalFiles = computed(() => readClinicalAttachments());

const education = computed(() => {
  return (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as Record<string, unknown>;
});

const books = computed(() => {
  const raw = education.value.books;
  return Array.isArray(raw) ? raw.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
});

const topics = computed(() => {
  const raw = education.value.topics;
  return Array.isArray(raw) ? raw.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
});

const selectedBook = computed(() => String(education.value.selectedBook ?? '').trim());
const selectedBooks = computed<string[]>(() => {
  const raw = (education.value as Record<string, unknown>).selectedBooks;
  if (!Array.isArray(raw)) {
    const legacy = selectedBook.value.trim();
    return legacy ? [legacy] : [];
  }
  return raw.map((b) => String(b ?? '').trim()).filter(Boolean);
});
const conversationDraft = computed(() => String(education.value.conversationDraft ?? ''));
const conversationLoading = computed(() => Boolean(education.value.conversationLoading));
const conversationError = computed(() => String(education.value.conversationError ?? '').trim());
const activeConversationId = computed(() => String(education.value.activeConversationId ?? '').trim());
const uiMode = computed<'flashcards' | 'conversation'>(() => {
  return String(education.value.uiMode ?? '').trim().toLowerCase() === 'flashcards'
    ? 'flashcards'
    : 'conversation';
});
const hasBooks = computed(() => books.value.length > 0);
const isBooksTab = computed(() => queryTab.value === 'books');
const isPrescriptionTab = computed(() => queryTab.value === 'prescription');

const bookFilterOpen = ref(false);
const bookFilterQuery = ref('');
const bookFilterButtonRef = ref<HTMLButtonElement | null>(null);
const bookFilterPanelRef = ref<HTMLDivElement | null>(null);

const filteredBooks = computed(() => {
  const q = bookFilterQuery.value.trim().toLowerCase();
  if (!q) return books.value;
  return books.value.filter((b) => b.toLowerCase().includes(q));
});

const selectedBooksCountLabel = computed(() => {
  const count = selectedBooks.value.length;
  if (count <= 0) return t('education.allBooks');
  return t('education.conversation.bookFilterSelectedCount', { count });
});

async function setSelectedBooks(nextBooks: string[]): Promise<void> {
  const normalized = nextBooks.map((b) => String(b ?? '').trim()).filter(Boolean);
  await execute({ actionId: 'set-doctor-education-books', data: { books: normalized } });
}

async function toggleBookSelection(book: string): Promise<void> {
  const b = String(book ?? '').trim();
  if (!b) return;
  const current = selectedBooks.value;
  const next = current.includes(b) ? current.filter((x) => x !== b) : [...current, b];
  await setSelectedBooks(next);
}

async function resetBookSelection(): Promise<void> {
  bookFilterQuery.value = '';
  await setSelectedBooks([]);
}

function closeBookFilter(): void {
  bookFilterOpen.value = false;
  bookFilterQuery.value = '';
}

function onBookFilterGlobalPointerDown(event: Event): void {
  if (!bookFilterOpen.value) return;
  const target = event.target as Node | null;
  const btn = bookFilterButtonRef.value;
  const panel = bookFilterPanelRef.value;
  if (!target || !btn || !panel) return;
  if (btn.contains(target) || panel.contains(target)) return;
  closeBookFilter();
}

function setQueryTab(tab: QueryTab) {
  queryTab.value = tab;
}

const userMessageRowClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.userRow' })
);
const userMessageBubbleClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.userBubble' })
);
const userMessageLabelClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.userLabel' })
);
const userMessageBodyClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.userBody' })
);
const resendButtonClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.resendButton' })
);
const resendButtonFailedClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.resendButtonFailed' })
);
const assistantMessageRowClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.assistantRow' })
);
const assistantMessageBubbleClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.assistantBubble' })
);
const assistantMessageLabelClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.assistantLabel' })
);
const assistantMessageBodyClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.assistantBody' })
);
const assistantMetaChipClass = computed(() =>
  resolveStyle({ styleTemplate: 'hosp.education.conversation.metaChip' })
);

const sessions = computed<ConversationSession[]>(() => {
  const raw = education.value.conversationSessions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const messagesRaw = Array.isArray(row.messages) ? row.messages : [];
      const messages = messagesRaw.map((message) => {
        const msg = (message ?? {}) as Record<string, unknown>;
        const imagesRaw = Array.isArray(msg.images) ? msg.images : [];
        return {
          id: String(msg.id ?? ''),
          role: String(msg.role ?? '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user',
          content: String(msg.content ?? '').trim(),
          createdAt: String(msg.createdAt ?? ''),
          loading: Boolean(msg.loading),
          error: String(msg.error ?? '').trim(),
          source: String(msg.source ?? '').trim(),
          chunksUsed: Number(msg.chunksUsed ?? 0) || undefined,
          followUpQuestions: (() => {
            const raw = msg.followUpQuestions ?? msg.follow_up_questions ?? msg.FollowUpQuestions;
            return Array.isArray(raw)
              ? raw.map((entry) => String(entry ?? '').trim()).filter(Boolean)
              : [];
          })(),
          sendFailedTimeout: Boolean(msg.sendFailedTimeout),
          retrievalQuestion: String(msg.retrievalQuestion ?? '').trim(),
          autoAttachmentPrompt: Boolean(msg.autoAttachmentPrompt),
          reference: (() => {
            const raw = msg.Reference ?? msg.reference;
            if (!Array.isArray(raw)) return [] as ConversationReference[];
            return raw
              .map((entry) => {
                const o = (entry ?? {}) as Record<string, unknown>;
                const bookName = String(o.BookName ?? o.bookName ?? '').trim();
                const page = Number(o.Page ?? o.page ?? 0) || 0;
                if (!bookName) return null;
                return { bookName, page } as ConversationReference;
              })
              .filter((x): x is ConversationReference => x !== null);
          })(),
          images: imagesRaw.map((image, index) => {
            const img = (image ?? {}) as Record<string, unknown>;
            return {
              imgIndex: Number(img.imgIndex ?? index) || index,
              page: Number(img.page ?? 0) || 0,
              ext: String(img.ext ?? 'png').trim() || 'png',
              caption: String(img.caption ?? '').trim(),
              imageData: String(img.imageData ?? '').trim(),
              url: String(img.url ?? '').trim(),
              sourceFile: String(img.sourceFile ?? '').trim()
            } as ConversationFigure;
          }).filter((image) => image.url)
        } as ConversationMessage;
      });
      return {
        id: String(row.id ?? ''),
        title: String(row.title ?? '').trim(),
        bookName: String(row.bookName ?? '').trim(),
        createdAt: String(row.createdAt ?? ''),
        updatedAt: String(row.updatedAt ?? ''),
        messages
      } as ConversationSession;
    })
    .filter((session) => session.id);
});

const activeSession = computed<ConversationSession | null>(() => {
  const id = activeConversationId.value;
  if (!id) return sessions.value[0] ?? null;
  return sessions.value.find((session) => session.id === id) ?? sessions.value[0] ?? null;
});

const messages = computed(() => activeSession.value?.messages ?? []);
const activeSessionTitle = computed(() => activeSession.value?.title || t('education.conversation.untitledSession'));
const activeSessionMessageCount = computed(() => messages.value.filter((message) => !message.loading).length);
const activeBookLabel = computed(() => activeSession.value?.bookName || selectedBook.value);

const canSendComposer = computed(() => {
  if (conversationLoading.value || prescriptionReading.value) return false;
  return Boolean(String(conversationDraft.value ?? '').trim());
});

function doctorBubbleDisplayContent(message: ConversationMessage): string {
  return stripEducationAttachedFileHeaders(String(message.content ?? ''));
}

function shouldShowResendForUserMessage(message: ConversationMessage): boolean {
  return Boolean(doctorBubbleDisplayContent(message));
}

function syncQuestionTextareaHeight(): void {
  const el = questionTextareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  const maxHeight = questionTextareaMaxHeightPx();
  const nextHeight = Math.min(el.scrollHeight, maxHeight);
  el.style.height = `${nextHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

async function focusQuestionTextarea(): Promise<void> {
  await nextTick();
  syncQuestionTextareaHeight();
  questionTextareaRef.value?.focus();
}

function scrollThreadToEnd(): void {
  void nextTick(() => {
    const el = threadRef.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  });
}

/** Keep the latest user turn + assistant reply in view (including NDJSON streaming). */
watch(messages, () => scrollThreadToEnd(), { deep: true, flush: 'post' });

watch(conversationDraft, () => {
  void nextTick(() => syncQuestionTextareaHeight());
});

onMounted(() => {
  if (typeof localStorage === 'undefined') {
    hasLoadedPanelPrefs.value = true;
    return;
  }
  try {
    const raw = localStorage.getItem(PANEL_PREFS_KEY);
    if (!raw) {
      hasLoadedPanelPrefs.value = true;
      return;
    }
    const prefs = JSON.parse(raw) as Record<string, unknown>;
    if (typeof prefs.showQuickStarts === 'boolean') {
      showQuickStarts.value = prefs.showQuickStarts;
    }
    if (typeof prefs.showSavedThreads === 'boolean') {
      showSavedThreads.value = prefs.showSavedThreads;
    }
  } catch {
    // ignore malformed local storage state
  } finally {
    hasLoadedPanelPrefs.value = true;
  }
});

onMounted(async () => {
  await focusQuestionTextarea();
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointerdown', onBookFilterGlobalPointerDown, true);
  }
  closePrescriptionCameraModal();
  if (autoSentNoticeTimer) {
    clearTimeout(autoSentNoticeTimer);
    autoSentNoticeTimer = null;
  }
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onBookFilterGlobalPointerDown, true);
  }
});

watch(
  [showQuickStarts, showSavedThreads],
  ([nextQuickStarts, nextSavedThreads]) => {
    if (!hasLoadedPanelPrefs.value || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        PANEL_PREFS_KEY,
        JSON.stringify({
          showQuickStarts: nextQuickStarts,
          showSavedThreads: nextSavedThreads
        })
      );
    } catch {
      // no-op
    }
  },
  { immediate: false }
);

watch(
  () => uiMode.value,
  async (mode) => {
    if (mode === 'conversation') {
      await focusQuestionTextarea();
    }
  }
);

watch(
  () => {
    const raw = education.value.attachmentSequenceSendRequest as { token?: string } | undefined;
    return String(raw?.token ?? '');
  },
  async (token) => {
    if (!token || token === lastSequenceSendToken.value) return;
    lastSequenceSendToken.value = token;
    const raw = education.value.attachmentSequenceSendRequest as
      | { payload?: Record<string, unknown> }
      | undefined;
    const payload = raw?.payload ?? {};
    const prev = (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as Record<string, unknown>;
    appStore.setData('hospital', 'DoctorEducationUiState', {
      ...prev,
      attachmentSequenceSendRequest: undefined
    });
    await execute({
      actionId: 'submit-doctor-education-conversation',
      data: payload
    });
    triggerAutoSentNotice();
  }
);

async function onModeChange(event: Event) {
  const value = String((event.target as HTMLSelectElement).value ?? '').trim().toLowerCase();
  await execute({
    actionId: 'set-doctor-education-mode',
    data: { mode: value === 'flashcards' ? 'flashcards' : 'conversation' }
  });
}

async function onDraftInput(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  const value = el.value;
  syncQuestionTextareaHeight();
  await execute({ actionId: 'set-doctor-education-conversation-draft', data: { value } });
}

async function startNewConversation() {
  writeClinicalAttachments([]);
  await execute({ actionId: 'start-new-doctor-education-conversation' });
}

async function openConversation(sessionId: string) {
  writeClinicalAttachments([]);
  await execute({ actionId: 'open-doctor-education-conversation', data: { sessionId } });
}

async function setPrompt(prompt: string) {
  await execute({ actionId: 'set-doctor-education-conversation-draft', data: { value: prompt } });
}

async function submitConversation(
  question?: string,
  opts?: {
    includeHistory?: boolean;
    skipSequenceModal?: boolean;
    retrievalQuestion?: string;
    /** Auto-send after file attach (no typed draft required). */
    bypassComposerGate?: boolean;
  }
) {
  const value = String(question ?? conversationDraft.value).trim();
  if (!value) return;
  if (!opts?.bypassComposerGate && !canSendComposer.value) return;
  if (readClinicalAttachments().length > 1 && !opts?.skipSequenceModal) {
    await openAttachmentSequenceModal();
    return;
  }
  const filesSnapshot = readClinicalAttachments();
  const autoQuestion = buildAutoQuestionFromAttachments().trim();
  const retrievalQuestion =
    opts?.retrievalQuestion ??
    buildEducationRetrievalQuestionWithAttachments(value, filesSnapshot);
  const userDisplayContent = buildEducationAttachmentDisplayContent(value, filesSnapshot, {
    autoQuestion
  });
  const hadAttachments = filesSnapshot.length > 0;
  if (hadAttachments) {
    writeClinicalAttachments([]);
  }
  await execute({
    actionId: 'submit-doctor-education-conversation',
    data: {
      question: value,
      retrievalQuestion,
      userDisplayContent,
      autoAttachmentPrompt: value === autoQuestion && hadAttachments,
      includeHistory: Boolean(opts?.includeHistory)
    }
  });
}

async function resendUserQuestion(message: ConversationMessage) {
  if (conversationLoading.value) return;
  const display = doctorBubbleDisplayContent(message);
  if (!display) return;
  const question = String(message.submittedQuestion ?? '').trim() || display;
  const storedRetrieval = String(message.retrievalQuestion ?? '').trim();
  const retrievalQuestion =
    storedRetrieval || buildEducationRetrievalQuestionWithAttachments(question, []);
  await execute({
    actionId: 'submit-doctor-education-conversation',
    data: {
      question,
      retrievalQuestion,
      userDisplayContent: display,
      replaceUserMessageId: message.id,
      autoAttachmentPrompt: Boolean(message.autoAttachmentPrompt)
    }
  });
}

async function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  await submitConversation();
}

function openPrescriptionFilePicker() {
  fileInputRef.value?.click();
}

function removeAttachedClinicalFile(id: string): void {
  writeClinicalAttachments(readClinicalAttachments().filter((row) => row.id !== id));
}

async function openAttachmentSequenceModal(): Promise<void> {
  await execute({ actionId: 'open-education-attachment-sequence-popup' });
}

async function sendWithAttachedFiles(): Promise<void> {
  const autoQuestion = String(conversationDraft.value ?? '').trim() || buildAutoQuestionFromAttachments();
  await submitConversation(autoQuestion, { skipSequenceModal: true, bypassComposerGate: true });
  triggerAutoSentNotice();
}

function buildAutoQuestionFromAttachments(): string {
  return t('education.conversation.autoQuestionFromAttachments');
}

function triggerAutoSentNotice(): void {
  showAutoSentNotice.value = true;
  if (autoSentNoticeTimer) clearTimeout(autoSentNoticeTimer);
  autoSentNoticeTimer = setTimeout(() => {
    showAutoSentNotice.value = false;
    autoSentNoticeTimer = null;
  }, 2600);
}

function closePrescriptionCameraModal(): void {
  const v = cameraVideoRef.value;
  if (v) {
    v.srcObject = null;
  }
  cameraStream.value?.getTracks().forEach((track) => track.stop());
  cameraStream.value = null;
  showPrescriptionCameraModal.value = false;
  cameraPreviewReady.value = false;
}

function onCameraPreviewMetadata() {
  cameraPreviewReady.value = true;
}

async function requestCameraStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });
  }
}

async function openPrescriptionCameraPicker() {
  if (conversationLoading.value || prescriptionReading.value) return;
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    cameraInputRef.value?.click();
    return;
  }
  try {
    const stream = await requestCameraStream();
    cameraStream.value = stream;
    cameraPreviewReady.value = false;
    showPrescriptionCameraModal.value = true;
    await nextTick();
    const el = cameraVideoRef.value;
    if (el) {
      el.srcObject = stream;
      await el.play().catch(() => {});
    }
  } catch {
    cameraInputRef.value?.click();
  }
}

async function capturePrescriptionCameraFrame() {
  const video = cameraVideoRef.value;
  if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
    toastStore.show(t('education.conversation.cameraNotReady'), 'error');
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    toastStore.show(t('education.conversation.prescriptionReadFailed'), 'error');
    return;
  }
  ctx.drawImage(video, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9);
  });
  closePrescriptionCameraModal();
  if (!blob) {
    toastStore.show(t('education.conversation.prescriptionReadFailed'), 'error');
    return;
  }
  const file = new File([blob], 'prescription-camera.jpg', { type: 'image/jpeg' });
  await ingestPrescriptionFiles([file]);
}

async function onPrescriptionFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (!files.length) return;
  await ingestPrescriptionFiles(files);
}

async function ingestPrescriptionFiles(files: File[]) {
  if (conversationLoading.value || prescriptionReading.value) return;
  const remainingSlots = MAX_CONVERSATION_ATTACHMENTS - readClinicalAttachments().length;
  if (remainingSlots <= 0) {
    toastStore.show(t('education.conversation.attachmentLimitReached', { count: MAX_CONVERSATION_ATTACHMENTS }), 'info');
    return;
  }
  const nextFiles = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    toastStore.show(t('education.conversation.attachmentLimitReached', { count: MAX_CONVERSATION_ATTACHMENTS }), 'info');
  }
  prescriptionReading.value = true;
  const added: EducationClinicalAttachment[] = [];
  try {
    for (const file of nextFiles) {
      const extracted = await postEducationPrescriptionTranscribe(file);
      const draft = buildPrescriptionQuestionDraft(extracted).trim();
      if (!draft) continue;
      added.push({
        id: `clinical-file-${crypto.randomUUID()}`,
        name: file.name || 'attachment',
        retrievalText: draft
      });
      if (isPrescriptionFullyNotStated(extracted)) {
        toastStore.show(t('education.conversation.prescriptionDraftOnly'), 'info');
      }
    }
    if (added.length > 0) {
      const merged = [...readClinicalAttachments(), ...added].slice(0, MAX_CONVERSATION_ATTACHMENTS);
      writeClinicalAttachments(merged);
      toastStore.show(t('education.conversation.filesAttached', { count: merged.length }), 'success');
      if (merged.length > 1) {
        await openAttachmentSequenceModal();
      } else {
        await sendWithAttachedFiles();
      }
    }
  } catch (err) {
    const msg =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : t('education.conversation.prescriptionReadFailed');
    toastStore.show(msg, 'error');
  } finally {
    prescriptionReading.value = false;
  }
}

function educationAssistantBody(message: ConversationMessage): string {
  if (message.loading) return '';
  if (message.role !== 'assistant') return message.content ?? '';
  return assistantDisplayBody(message.content ?? '');
}

function educationAssistantFollowUps(message: ConversationMessage): string[] {
  if (message.loading || message.role !== 'assistant') return [];
  return assistantDisplayFollowUps(message.content ?? '', message.followUpQuestions);
}

function threadPreviewLine(message: ConversationMessage | undefined): string {
  if (!message?.content?.trim()) return t('education.conversation.noMessagesYet');
  if (message.role === 'assistant') {
    const body = assistantDisplayBody(message.content).trim();
    return body || t('education.conversation.noMessagesYet');
  }
  return message.content.trim();
}
</script>

<template>
  <section :id="htmlId" class="rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
    <div class="px-4 py-4 sm:px-5">
      <div class="flex min-h-[min(88dvh,calc(100dvh-6rem))] flex-col gap-0">
        <div class="order-1 shrink-0 space-y-5">
        <div class="flex items-start justify-between gap-3 min-w-0">
          <div class="min-w-0 flex-1 space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">
              {{ t('education.conversation.historyTitle') }}
            </p>
            <h3 class="text-xl font-semibold text-slate-900">{{ t('education.conversation.inputLabel') }}</h3>
            <div class="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-sky-100"
                :class="isBooksTab
                  ? 'border-sky-300 bg-sky-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50'"
                @click="setQueryTab('books')"
              >
                {{ t('education.conversation.tabs.books') }}
              </button>
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-sky-100"
                :class="isPrescriptionTab
                  ? 'border-sky-300 bg-sky-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50'"
                @click="setQueryTab('prescription')"
              >
                {{ t('education.conversation.tabs.prescription') }}
              </button>
            </div>
          </div>

          <div v-if="isBooksTab" class="shrink-0 flex items-center justify-end">
            <button
              type="button"
              class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100"
              :aria-label="showConversationControls ? t('education.conversation.closeControls') : t('education.conversation.openControls')"
              :title="showConversationControls ? t('education.conversation.closeControls') : t('education.conversation.openControls')"
              @click="showConversationControls = !showConversationControls"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h10" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 7h2" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 12h4" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 12h8" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 17h8" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 17h4" />
                <circle cx="15" cy="7" r="2" />
                <circle cx="10" cy="12" r="2" />
                <circle cx="14" cy="17" r="2" />
              </svg>
            </button>
          </div>
        </div>

        <div
          v-if="isBooksTab && hasBooks"
          class="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center"
        >
          <label for="doctor-education-conversation-book" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ t('education.filterBook') }}
          </label>
          <div class="relative">
            <button
              ref="bookFilterButtonRef"
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              :aria-expanded="bookFilterOpen ? 'true' : 'false'"
              aria-haspopup="listbox"
              @click="bookFilterOpen = !bookFilterOpen"
            >
              <span class="min-w-0 truncate">{{ selectedBooksCountLabel }}</span>
              <span class="shrink-0 text-slate-500" aria-hidden="true">▾</span>
            </button>

            <div
              v-if="bookFilterOpen"
              ref="bookFilterPanelRef"
              class="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
              role="dialog"
              :aria-label="t('education.filterBook')"
            >
              <div class="border-b border-slate-100 p-3">
                <div class="flex items-center gap-2">
                  <input
                    v-model="bookFilterQuery"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    :placeholder="t('education.conversation.bookFilterSearchPlaceholder')"
                  />
                  <button
                    type="button"
                    class="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="selectedBooks.length === 0 && !bookFilterQuery.trim()"
                    @click="resetBookSelection"
                  >
                    {{ t('education.conversation.bookFilterReset') }}
                  </button>
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  {{ t('education.conversation.bookFilterSelectedCount', { count: selectedBooks.length }) }}
                </p>
              </div>

              <div class="max-h-72 overflow-y-auto p-2" role="listbox" :aria-multiselectable="'true'">
                <button
                  v-for="book in filteredBooks"
                  :key="book"
                  type="button"
                  class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  @click="toggleBookSelection(book)"
                >
                  <span
                    class="grid h-5 w-5 place-items-center rounded border border-slate-300 bg-white text-[12px] font-bold text-sky-700"
                    :class="selectedBooks.includes(book) ? 'border-sky-300 bg-sky-50' : ''"
                    aria-hidden="true"
                  >
                    {{ selectedBooks.includes(book) ? '✓' : '' }}
                  </span>
                  <span class="min-w-0 flex-1 truncate">{{ book }}</span>
                </button>

                <p v-if="filteredBooks.length === 0" class="px-3 py-3 text-sm text-slate-500">
                  {{ t('education.conversation.bookFilterNoResults') }}
                </p>
              </div>

              <div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-white p-3">
                <button
                  type="button"
                  class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                  @click="closeBookFilter"
                >
                  {{ t('common.close') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="isBooksTab && showConversationControls"
          class="space-y-4 rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,_rgba(239,246,255,0.9),_rgba(255,255,255,0.96))] p-4 shadow-sm"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm">
              {{ t('education.conversation.currentSession') }}: {{ activeSessionTitle }}
            </span>
            <span class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              {{ t('education.conversation.messageCount', { count: activeSessionMessageCount }) }}
            </span>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
              @click="startNewConversation"
            >
              {{ t('education.conversation.newConversation') }}
            </button>
          </div>

          <label class="flex w-full max-w-xs flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>{{ t('education.workspace.modeLabel') }}</span>
            <select
              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              :value="uiMode"
              @change="onModeChange"
            >
              <option value="conversation">{{ t('education.workspace.modeConversation') }}</option>
              <option value="flashcards">{{ t('education.workspace.modeFlashcards') }}</option>
            </select>
          </label>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
              @click="showQuickStarts = !showQuickStarts"
            >
              {{ showQuickStarts ? t('education.conversation.hideQuickStarts') : t('education.conversation.showQuickStarts') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
              @click="showSavedThreads = !showSavedThreads"
            >
              {{ showSavedThreads ? t('education.conversation.hideSavedThreads') : t('education.conversation.showSavedThreads') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              @click="showConversationControls = false"
            >
              {{ t('education.conversation.done') }}
            </button>
          </div>

          <div v-if="showQuickStarts && topics.length > 0" class="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div class="mb-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('education.conversation.quickStartsTitle') }}</p>
              <p class="text-sm text-slate-600">{{ t('education.conversation.quickStartsSubtitle') }}</p>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <button
                v-for="topic in topics"
                :key="topic"
                type="button"
                class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50"
                @click="setPrompt(topic)"
              >
                {{ topic }}
              </button>
            </div>
          </div>

          <div
            v-if="showSavedThreads"
            class="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
          >
            <div class="mb-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('education.conversation.savedThreadsTitle') }}</p>
              <p class="text-sm text-slate-600">{{ t('education.conversation.savedThreadsSubtitle') }}</p>
            </div>
            <div class="space-y-2">
              <button
                v-for="session in sessions"
                :key="session.id"
                type="button"
                class="w-full rounded-2xl border px-3 py-3 text-left transition"
                :class="session.id === activeSession?.id
                  ? 'border-sky-300 bg-sky-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50'"
                @click="openConversation(session.id)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-slate-900">{{ session.title }}</p>
                    <p class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {{ threadPreviewLine(session.messages[session.messages.length - 1]) }}
                    </p>
                  </div>
                  <span
                    v-if="session.bookName"
                    class="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {{ session.bookName }}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
        </div>

        <DynDoctorEducationPrescriptionSimilarity
          v-if="isPrescriptionTab"
          class="order-2 flex min-h-0 flex-1 flex-col pt-4"
        />

        <div
          v-if="isBooksTab"
          class="order-2 flex min-h-0 flex-col border-slate-200"
          :class="
            messages.length > 0
              ? 'min-h-[10rem] flex-1 border-t pt-4'
              : 'max-h-0 flex-none overflow-hidden border-t-0 p-0'
          "
        >
          <div
            ref="threadRef"
            class="min-h-0 space-y-4 overflow-y-auto pb-6 pr-0.5"
            :class="messages.length > 0 ? 'flex-1' : ''"
            role="log"
            aria-live="polite"
          >
            <template v-for="message in messages" :key="message.id">
              <div v-if="message.role === 'user'" :class="userMessageRowClass">
                <article :class="userMessageBubbleClass">
                  <p :class="userMessageLabelClass">
                    {{ t('education.conversation.userLabel') }}
                  </p>
                  <p :class="[userMessageBodyClass, 'whitespace-pre-wrap']">
                    {{ doctorBubbleDisplayContent(message) }}
                  </p>
                </article>
                <button
                  v-if="shouldShowResendForUserMessage(message)"
                  type="button"
                  :class="message.sendFailedTimeout ? resendButtonFailedClass : resendButtonClass"
                  :disabled="conversationLoading"
                  :title="t('education.conversation.resendTitle')"
                  :aria-label="t('education.conversation.resendAria')"
                  @click="resendUserQuestion(message)"
                >
                  <span class="text-lg font-bold leading-none" aria-hidden="true">↻</span>
                </button>
              </div>

              <div v-else :class="assistantMessageRowClass">
                <article :class="assistantMessageBubbleClass">
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <span :class="assistantMessageLabelClass">
                      {{ t('education.conversation.assistantLabel') }}
                    </span>
                    <span v-if="message.source" :class="assistantMetaChipClass">
                      {{ t('education.conversation.sourceChip', { source: message.source }) }}
                    </span>
                    <span v-if="message.chunksUsed" :class="assistantMetaChipClass">
                      {{ t('education.conversation.chunksChip', { count: message.chunksUsed }) }}
                    </span>
                    <span v-if="activeSession?.bookName" :class="assistantMetaChipClass">
                      {{ activeSession.bookName }}
                    </span>
                  </div>

                  <div
                    v-if="message.loading && !message.content?.trim()"
                    class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600"
                  >
                    <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                    <span>{{ t('education.conversation.loadingAnswer') }}</span>
                  </div>
                  <p v-else :class="assistantMessageBodyClass">
                    {{ message.loading ? message.content : educationAssistantBody(message) }}
                  </p>

                  <div
                    v-if="!message.loading && message.reference && message.reference.length > 0"
                    class="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-3"
                  >
                    <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {{ t('education.conversation.referenceTitle') }}
                    </p>
                    <ul class="list-inside list-disc space-y-1 text-sm text-slate-700">
                      <li v-for="(ref, refIdx) in message.reference" :key="`${message.id}-ref-${refIdx}`">
                        {{ t('education.conversation.referenceLine', { book: ref.bookName, page: ref.page + 1 }) }}
                      </li>
                    </ul>
                  </div>

                  <div v-if="!message.loading && message.images && message.images.length > 0" class="mt-4 space-y-3">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('education.conversation.figuresTitle') }}</p>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <a
                        v-for="image in message.images"
                        :key="`${message.id}-${image.imgIndex}`"
                        :href="image.url"
                        target="_blank"
                        rel="noreferrer"
                        class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                      >
                        <img
                          :src="image.url"
                          :alt="image.caption || t('education.conversation.figureAlt', { page: image.page + 1 })"
                          class="h-44 w-full bg-slate-100 object-cover"
                          loading="lazy"
                        />
                        <div class="space-y-2 px-3 py-3">
                          <div class="flex items-center justify-between gap-2">
                            <span class="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                              {{ t('education.conversation.pageBadge', { page: image.page + 1 }) }}
                            </span>
                            <span class="text-[11px] font-medium text-slate-500">{{ image.ext.toUpperCase() }}</span>
                          </div>
                        </div>
                      </a>
                    </div>
                  </div>

                  <div v-if="!message.loading && educationAssistantFollowUps(message).length > 0" class="mt-4 space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('education.conversation.followUpTitle') }}</p>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="followUp in educationAssistantFollowUps(message)"
                        :key="followUp"
                        type="button"
                        class="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-50"
                        @click="submitConversation(followUp, { includeHistory: true })"
                      >
                        {{ followUp }}
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            </template>
          </div>
        </div>

        <div v-if="isBooksTab" class="order-3 shrink-0 space-y-3 bg-white/95 pt-4 pb-2">
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2 min-w-0">
              <label for="doctor-education-conversation-draft" class="text-xs font-semibold uppercase tracking-wide text-slate-500 min-w-0">
                {{ t('education.conversation.inputPromptLabel') }}
              </label>
              <div class="flex shrink-0 items-center gap-1">
                <input
                  ref="fileInputRef"
                  type="file"
                  class="sr-only"
                  multiple
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  @change="onPrescriptionFileInput"
                />
                <input
                  ref="cameraInputRef"
                  type="file"
                  class="sr-only"
                  accept="image/*"
                  capture="environment"
                  @change="onPrescriptionFileInput"
                />
                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="conversationLoading || prescriptionReading"
                  :aria-label="t('education.conversation.attachFileAria')"
                  :title="t('education.conversation.attachFileAria')"
                  @click="openPrescriptionFilePicker"
                >
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.64 16.78a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="conversationLoading || prescriptionReading"
                  :aria-label="t('education.conversation.attachCameraAria')"
                  :title="t('education.conversation.attachCameraAria')"
                  @click="openPrescriptionCameraPicker"
                >
                  <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 7a2 2 0 012-2h2.5L10 4h4l1.5 1H18a2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
                  </svg>
                </button>
              </div>
            </div>
            <textarea
              ref="questionTextareaRef"
              id="doctor-education-conversation-draft"
              :value="conversationDraft"
              rows="1"
              class="w-full resize-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:opacity-60"
              :disabled="conversationLoading || prescriptionReading"
              :placeholder="t('education.conversation.inputPlaceholder')"
              @input="onDraftInput"
              @keydown="onComposerKeydown"
            />
            <div v-if="attachedClinicalFiles.length > 0" class="flex flex-wrap items-center gap-2 pt-1">
              <div
                v-for="(file, fileIndex) in attachedClinicalFiles"
                :key="file.id"
                class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900"
              >
                <span
                  class="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border border-sky-300 bg-white px-1 text-[10px] font-bold text-sky-700"
                  :title="t('education.conversation.attachmentOrderLabel', { order: fileIndex + 1 })"
                >
                  {{ fileIndex + 1 }}
                </span>
                <span class="max-w-[18rem] truncate">
                  {{ t('education.conversation.attachedFile', { name: file.name }) }}
                </span>
                <button
                  v-if="attachedClinicalFiles.length === 1"
                  type="button"
                  class="rounded-full border border-sky-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-sky-800 transition hover:bg-sky-100"
                  @click="removeAttachedClinicalFile(file.id)"
                >
                  {{ t('education.conversation.removeFile') }}
                </button>
              </div>
              <button
                v-if="attachedClinicalFiles.length > 1"
                type="button"
                class="rounded-full border border-sky-300 bg-white px-3 py-1 text-xs font-semibold text-sky-800 shadow-sm transition hover:bg-sky-50"
                @click="openAttachmentSequenceModal"
              >
                {{ t('education.conversation.reviewSequence') }}
              </button>
            </div>
          </div>

          <p v-if="conversationError" class="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {{ conversationError }}
          </p>

          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p class="text-xs leading-5 text-slate-500">
              <span v-if="prescriptionReading" class="font-medium text-sky-700">{{ t('education.conversation.readingPrescription') }}</span>
              <span v-else-if="attachedClinicalFiles.length > 1">
                {{ t('education.conversation.attachmentsConfirmSequenceHint', { count: attachedClinicalFiles.length }) }}
              </span>
              <span v-else-if="attachedClinicalFiles.length === 1">
                {{ t('education.conversation.attachmentsReadyHint', { count: 1 }) }}
              </span>
              <span v-else>{{ t('education.conversation.submitHint') }}</span>
              <span
                v-if="showAutoSentNotice"
                class="ml-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
              >
                {{ t('education.conversation.autoSentNotice') }}
              </span>
            </p>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              :disabled="!canSendComposer"
              @click="submitConversation()"
            >
              {{ conversationLoading ? t('education.conversation.sending') : t('education.conversation.send') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
  <Teleport to="body">
    <div
      v-if="showPrescriptionCameraModal"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('education.conversation.cameraModalTitle')"
      @click.self="closePrescriptionCameraModal"
    >
      <div
        class="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-600 bg-slate-900 p-4 shadow-2xl sm:p-5"
        @click.stop
      >
        <p class="text-sm font-semibold text-white">{{ t('education.conversation.cameraModalTitle') }}</p>
        <p class="mt-1 text-xs leading-relaxed text-slate-400">{{ t('education.conversation.cameraModalHint') }}</p>
        <video
          ref="cameraVideoRef"
          class="mt-3 aspect-video w-full rounded-2xl bg-black object-cover"
          playsinline
          muted
          @loadedmetadata="onCameraPreviewMetadata"
        />
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl border border-slate-500 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-500/40"
            @click="closePrescriptionCameraModal"
          >
            {{ t('education.conversation.cameraModalCancel') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-300/50 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            :disabled="!cameraPreviewReady"
            @click="capturePrescriptionCameraFrame"
          >
            {{ t('education.conversation.cameraModalCapture') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
