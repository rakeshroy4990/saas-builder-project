import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import type { Composer } from 'vue-i18n';
import type { AxiosResponse } from 'axios';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { i18n } from '../../../../i18n';
import { apiClient } from '../../../http/apiClient';
import { postHospitalAiChatNdjson } from '../../../http/hospitalAiChatStream';
import { isRequestTimeoutError, requestTimeoutMessage } from '../../../http/httpUserFacingErrors';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { assistantDisplayBody, assistantDisplayFollowUps, tryParseEmbeddedAssistantJson } from './educationAssistantPayload';

type EducationViewMode = 'flashcards' | 'conversation';
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
  /** 0-based page index from RAG (display as page+1, same convention as figure thumbnails). */
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
  /** Set after a failed send; UI may emphasize the resend control until cleared on the next send. */
  sendFailedTimeout?: boolean;
};
type ConversationSession = {
  id: string;
  title: string;
  bookName?: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};
type EducationConversationState = {
  uiMode?: EducationViewMode;
  selectedBook?: string;
  conversationDraft?: string;
  conversationSessions?: ConversationSession[];
  activeConversationId?: string;
  conversationLoading?: boolean;
  conversationError?: string;
};

function educationStreamStatusLabel(phase: string): string {
  const tc = educationComposer().t;
  if (phase === 'retrieving' || phase === 'accepted') {
    return tc('education.conversation.searchingSources');
  }
  if (phase === 'generating') {
    return tc('education.conversation.generatingAnswer');
  }
  return tc('education.conversation.loadingAnswer');
}

function educationComposer(): Composer {
  return i18n.global as Composer;
}

function getEducationState(appStore: ReturnType<typeof useAppStore>): EducationConversationState {
  return (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as EducationConversationState;
}

function readHospitalEnvelopeData<T>(response: AxiosResponse<unknown>): T | null {
  const root = response.data as Record<string, unknown> | undefined;
  if (!root) return null;
  const okNode = Boolean(root.Success ?? root.success);
  if (!okNode) return null;
  return (root.Data ?? root.data) as T;
}

/** Some gateways double-encode `Data` as a JSON string, or return a bare JSON string body. */
function normalizeApiPayloadRoot(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === 'string') {
    const embedded = tryParseEmbeddedAssistantJson(input);
    if (embedded) {
      return {
        answer: embedded.answer,
        follow_up_questions: embedded.followUpQuestions
      };
    }
  }
  return {};
}

function normalizeMode(raw: unknown): EducationViewMode {
  return String(raw ?? '').trim().toLowerCase() === 'flashcards' ? 'flashcards' : 'conversation';
}

function normalizeConversationFigure(raw: unknown, fallbackIndex: number): ConversationFigure | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  const url = String(row.url ?? row.Url ?? '').trim();
  if (!url) return null;
  return {
    imgIndex: Number(row.imgIndex ?? row.ImgIndex ?? fallbackIndex) || fallbackIndex,
    page: Number(row.page ?? row.Page ?? 0) || 0,
    ext: String(row.ext ?? row.Ext ?? 'png').trim() || 'png',
    caption: String(row.caption ?? row.Caption ?? '').trim(),
    imageData: String(row.imageData ?? row.ImageData ?? '').trim(),
    url,
    sourceFile: String(row.sourceFile ?? row.SourceFile ?? '').trim()
  };
}

function readFollowUpList(row: Record<string, unknown>): string[] {
  const raw =
    row.followUpQuestions ?? row.follow_up_questions ?? row.FollowUpQuestions;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function readReferenceList(row: Record<string, unknown>): ConversationReference[] {
  const raw = row.Reference ?? row.reference;
  if (!Array.isArray(raw)) return [];
  const out: ConversationReference[] = [];
  for (const item of raw) {
    const o = (item ?? {}) as Record<string, unknown>;
    const bookName = String(o.BookName ?? o.bookName ?? '').trim();
    const page = Number(o.Page ?? o.page ?? 0) || 0;
    if (!bookName) continue;
    out.push({ bookName, page });
  }
  return out;
}

function normalizeConversationMessage(raw: unknown, fallbackIndex: number): ConversationMessage | null {
  const row = (raw ?? {}) as Record<string, unknown>;
  const role = String(row.role ?? '').trim().toLowerCase() === 'assistant' ? 'assistant' : 'user';
  const content = String(row.content ?? '').trim();
  const imagesRaw = Array.isArray(row.images) ? row.images : [];
  return {
    id: String(row.id ?? `education-conversation-msg-${fallbackIndex + 1}`),
    role,
    content,
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    loading: Boolean(row.loading),
    error: String(row.error ?? '').trim(),
    source: String(row.source ?? '').trim(),
    chunksUsed: Number(row.chunksUsed ?? 0) || undefined,
    followUpQuestions: readFollowUpList(row),
    sendFailedTimeout: Boolean(row.sendFailedTimeout),
    images: imagesRaw
      .map((item, idx) => normalizeConversationFigure(item, idx))
      .filter((item): item is ConversationFigure => item !== null),
    reference: readReferenceList(row)
  };
}

function normalizeConversationSessions(raw: unknown): ConversationSession[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const messagesRaw = Array.isArray(row.messages) ? row.messages : [];
      const messages = messagesRaw
        .map((message, messageIndex) => normalizeConversationMessage(message, messageIndex))
        .filter((message): message is ConversationMessage => message !== null);
      return {
        id: String(row.id ?? `education-session-${index + 1}`),
        title: String(row.title ?? '').trim() || educationComposer().t('education.conversation.newConversation'),
        bookName: String(row.bookName ?? '').trim(),
        createdAt: String(row.createdAt ?? new Date().toISOString()),
        updatedAt: String(row.updatedAt ?? row.createdAt ?? new Date().toISOString()),
        messages
      };
    })
    .filter((session) => session.id.trim() !== '');
}

function createConversationSession(bookName: string): ConversationSession {
  const now = new Date().toISOString();
  return {
    id: `education-conversation-${crypto.randomUUID()}`,
    title: educationComposer().t('education.conversation.newConversation'),
    bookName: bookName.trim(),
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function firstMeaningfulQuestionTitle(question: string): string {
  const text = String(question ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return educationComposer().t('education.conversation.untitledSession');
  return text.length > 48 ? `${text.slice(0, 47).trimEnd()}…` : text;
}

function updateSessions(
  sessions: ConversationSession[],
  sessionId: string,
  updater: (session: ConversationSession) => ConversationSession
): ConversationSession[] {
  return sessions.map((session) => (session.id === sessionId ? updater(session) : session));
}

function stripEducationSendTimeoutFlags(messages: ConversationMessage[]): ConversationMessage[] {
  return messages.map((m) => {
    if (!m.sendFailedTimeout) return m;
    const { sendFailedTimeout: _flag, ...rest } = m;
    return rest as ConversationMessage;
  });
}

/** Remove the selected user message and every message after it (used when resending that question). */
function truncateMessagesForResend(
  messages: ConversationMessage[],
  replaceUserMessageId: string
): ConversationMessage[] {
  const idx = messages.findIndex((m) => m.id === replaceUserMessageId);
  if (idx < 0) return messages;
  return messages.slice(0, idx);
}

/** Use inner `Data` when the caller passed the full hospital envelope by mistake. */
function resolveChatPayloadRow(data: Record<string, unknown>): Record<string, unknown> {
  const hasDirectText = ['reply', 'message', 'answer', 'Answer'].some((key) => {
    const v = data[key];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
  if (hasDirectText) return data;
  const nested = data.Data ?? data.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return data;
}

function extractConversationResponse(data: unknown): {
  answer: string;
  source: string;
  chunksUsed?: number;
  followUpQuestions: string[];
  images: ConversationFigure[];
  reference: ConversationReference[];
} {
  const root = normalizeApiPayloadRoot(data);
  const row = resolveChatPayloadRow(root);
  const rawFollowUps =
    row.followUpQuestions ?? row.follow_up_questions ?? row.FollowUpQuestions;
  let followUpQuestions = Array.isArray(rawFollowUps)
    ? rawFollowUps.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 6)
    : [];
  const rawImages = row.images ?? row.Images;
  const images = Array.isArray(rawImages)
    ? rawImages
      .map((item, index) => normalizeConversationFigure(item, index))
      .filter((item): item is ConversationFigure => item !== null)
    : [];
  const chunksUsed = Number(row.chunksUsed ?? row.ChunksUsed ?? 0) || undefined;
  let answer = String(row.reply ?? row.message ?? row.answer ?? row.Answer ?? '').trim();
  const unwrapNested = (text: string): { text: string; extras: string[] } => {
    const embedded = tryParseEmbeddedAssistantJson(text);
    if (!embedded) return { text, extras: [] };
    return { text: embedded.answer, extras: embedded.followUpQuestions };
  };
  let unwrapped = unwrapNested(answer);
  answer = unwrapped.text;
  if (followUpQuestions.length === 0 && unwrapped.extras.length > 0) {
    followUpQuestions = unwrapped.extras;
  }
  if (answer.startsWith('{')) {
    unwrapped = unwrapNested(answer);
    if (unwrapped.extras.length > 0 || unwrapped.text !== answer) {
      answer = unwrapped.text;
      if (followUpQuestions.length === 0 && unwrapped.extras.length > 0) {
        followUpQuestions = unwrapped.extras;
      }
    }
  }
  if (!answer) {
    const topAnswer = String(root.answer ?? root.Answer ?? '').trim();
    if (topAnswer) answer = topAnswer;
  }
  if (!answer && data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const topAnswer = String(d.answer ?? d.Answer ?? '').trim();
    if (topAnswer) answer = topAnswer;
  }
  if (followUpQuestions.length === 0) {
    const topFu =
      root.followUpQuestions ?? root.follow_up_questions ?? root.FollowUpQuestions;
    if (Array.isArray(topFu)) {
      followUpQuestions = topFu.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 6);
    }
  }
  if (followUpQuestions.length === 0 && data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const topFu = d.followUpQuestions ?? d.follow_up_questions ?? d.FollowUpQuestions;
    if (Array.isArray(topFu)) {
      followUpQuestions = topFu.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 6);
    }
  }
  let reference = readReferenceList(row);
  if (reference.length === 0) {
    const topRef = root.Reference ?? root.reference;
    if (Array.isArray(topRef)) {
      reference = readReferenceList({ Reference: topRef });
    }
  }
  if (reference.length === 0 && data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    reference = readReferenceList(d);
  }
  return {
    answer,
    source: String(row.source ?? row.Source ?? row.mode ?? '').trim(),
    chunksUsed,
    followUpQuestions,
    images,
    reference
  };
}

/** Matches backend `AiChatMessageDto` `@Size(max = 2000)` on `/api/hospital/ai/chat`. */
const AI_CHAT_HISTORY_CONTENT_MAX = 2000;

function truncateAiChatHistoryContent(content: string): string {
  const t = content.trim();
  if (t.length <= AI_CHAT_HISTORY_CONTENT_MAX) return t;
  const mark = '\n[…]';
  const room = AI_CHAT_HISTORY_CONTENT_MAX - mark.length;
  return `${t.slice(0, Math.max(0, room)).trimEnd()}${mark}`;
}

/**
 * Prior turns only for the chat API (excludes the trailing user message — it duplicates `message`).
 * When `includeHistory` is false, sends [] so new questions / prescription flow do not attach huge threads.
 * When true (e.g. follow-up chip), sends up to 12 prior turns with per-message truncation for validation.
 */
function buildConversationHistory(
  session: ConversationSession,
  includeHistory: boolean
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!includeHistory) {
    return [];
  }
  const filtered = session.messages.filter(
    (message) => !message.loading && !message.error && String(message.content ?? '').trim()
  );
  let turns = filtered.slice(-12);
  const last = turns[turns.length - 1];
  if (last && last.role === 'user') {
    turns = turns.slice(0, -1);
  }
  return turns
    .map((message) => {
      const raw = String(message.content ?? '').trim();
      const body =
        message.role === 'assistant' ? assistantDisplayBody(raw).trim() || raw : raw;
      return {
        role: message.role,
        content: truncateAiChatHistoryContent(body)
      };
    })
    .filter((row) => row.content.length > 0);
}

function educationConversationPayload(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  bookName: string,
  conversationId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    message: question,
    history,
    conversationId,
    RetrievalQuestion: question
  };
  const bn = bookName.trim();
  if (bn) payload.BookName = bn;
  return payload;
}

function localizedConversationError(fallbackKey: string, error: unknown): string {
  const composer = educationComposer();
  const fallback = composer.t(fallbackKey);
  if (isRequestTimeoutError(error)) {
    return requestTimeoutMessage();
  }
  if (isAxiosError(error)) {
    const payload = (error.response?.data ?? {}) as Record<string, unknown>;
    const exact = String(payload.Message ?? payload.message ?? error.message ?? '').trim();
    return exact || fallback;
  }
  if (error instanceof Error) {
    const m = String(error.message ?? '').trim();
    if (m) return m;
  }
  return fallback;
}

function ensureConversationState(state: EducationConversationState): Required<Pick<
  EducationConversationState,
  'uiMode' | 'conversationDraft' | 'activeConversationId' | 'conversationLoading' | 'conversationError'
>> & { conversationSessions: ConversationSession[] } {
  const sessions = normalizeConversationSessions(state.conversationSessions);
  const selectedBook = String(state.selectedBook ?? '').trim();
  const nextSessions = sessions.length > 0 ? sessions : [createConversationSession(selectedBook)];
  let activeConversationId = String(state.activeConversationId ?? '').trim();
  if (!nextSessions.some((session) => session.id === activeConversationId)) {
    activeConversationId = nextSessions[0]?.id ?? '';
  }
  return {
    uiMode: normalizeMode(state.uiMode),
    conversationDraft: String(state.conversationDraft ?? ''),
    activeConversationId,
    conversationLoading: Boolean(state.conversationLoading),
    conversationError: String(state.conversationError ?? ''),
    conversationSessions: nextSessions
  };
}

function doctorOnlyError() {
  return educationComposer().t('page.doctorEducation.doctorsOnly');
}

export const doctorEducationConversationHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-doctor-education-conversation',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      const next = ensureConversationState(prev);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        uiMode: 'conversation',
        conversationDraft: next.conversationDraft,
        activeConversationId: next.activeConversationId,
        conversationLoading: false,
        conversationError: '',
        conversationSessions: next.conversationSessions
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-doctor-education-mode',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      const mode = normalizeMode(request.data?.mode);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        uiMode: mode
      });
      return ok({ mode });
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-doctor-education-conversation-draft',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        conversationDraft: String(request.data?.value ?? ''),
        conversationError: ''
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'start-new-doctor-education-conversation',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      const selectedBook = String(prev.selectedBook ?? '').trim();
      const ensured = ensureConversationState(prev);
      const fresh = createConversationSession(selectedBook);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        uiMode: 'conversation',
        conversationDraft: '',
        conversationError: '',
        conversationLoading: false,
        activeConversationId: fresh.id,
        conversationSessions: [fresh, ...ensured.conversationSessions]
      });
      return ok({ sessionId: fresh.id });
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-doctor-education-conversation',
    execute: async (request) => {
      const sessionId = String(request.data?.sessionId ?? '').trim();
      if (!sessionId) return ok();
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      const ensured = ensureConversationState(prev);
      const match = ensured.conversationSessions.find((session) => session.id === sessionId);
      if (!match) return ok();
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        uiMode: 'conversation',
        activeConversationId: match.id,
        selectedBook: match.bookName?.trim() || String(prev.selectedBook ?? '').trim(),
        conversationError: ''
      });
      return ok({ sessionId: match.id });
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'submit-doctor-education-conversation',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(auth.role ?? '').trim().toUpperCase();
      if (role !== 'DOCTOR') {
        return { responseCode: 'DOCTOR_EDUCATION_CONVERSATION_FORBIDDEN', message: doctorOnlyError() };
      }

      const prev = getEducationState(appStore);
      const draft = String(request.data?.question ?? prev.conversationDraft ?? '').trim();
      const replaceUserMessageId = String(request.data?.replaceUserMessageId ?? '').trim();
      const includeHistory = Boolean(request.data?.includeHistory);
      if (!draft) {
        return {
          responseCode: 'DOCTOR_EDUCATION_CONVERSATION_EMPTY',
          message: educationComposer().t('education.conversation.emptyQuestion')
        };
      }

      const ensured = ensureConversationState(prev);
      const selectedBook = String(prev.selectedBook ?? '').trim();
      const sessionId = ensured.activeConversationId || ensured.conversationSessions[0]?.id || '';
      const activeSession = ensured.conversationSessions.find((session) => session.id === sessionId)
        ?? createConversationSession(selectedBook);
      const stripped = stripEducationSendTimeoutFlags(activeSession.messages);
      const baseMessages = replaceUserMessageId
        ? truncateMessagesForResend(stripped, replaceUserMessageId)
        : stripped;
      const userMessage: ConversationMessage = {
        id: `education-user-${crypto.randomUUID()}`,
        role: 'user',
        content: draft,
        createdAt: new Date().toISOString()
      };
      const loadingMessage: ConversationMessage = {
        id: `education-assistant-${crypto.randomUUID()}`,
        role: 'assistant',
        content: educationComposer().t('education.conversation.loadingAnswer'),
        createdAt: new Date().toISOString(),
        loading: true
      };
      const hadPriorUserTurns = baseMessages.some((message) => message.role === 'user');
      const nextActiveSession: ConversationSession = {
        ...activeSession,
        title: hadPriorUserTurns ? activeSession.title : firstMeaningfulQuestionTitle(draft),
        updatedAt: new Date().toISOString(),
        bookName: selectedBook,
        messages: [...baseMessages, userMessage, loadingMessage]
      };
      const nextSessions = ensured.conversationSessions.some((session) => session.id === nextActiveSession.id)
        ? updateSessions(ensured.conversationSessions, nextActiveSession.id, () => nextActiveSession)
        : [nextActiveSession, ...ensured.conversationSessions];

      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        uiMode: 'conversation',
        conversationDraft: '',
        conversationLoading: true,
        conversationError: '',
        activeConversationId: nextActiveSession.id,
        conversationSessions: nextSessions
      });

      let streamSettled = false;
      let patchTimer: ReturnType<typeof setTimeout> | null = null;
      const cancelPendingBubblePatch = (): void => {
        if (patchTimer !== null) {
          clearTimeout(patchTimer);
          patchTimer = null;
        }
      };

      try {
        const history = buildConversationHistory(nextActiveSession, includeHistory);
        let acc = '';
        let pendingBubbleContent = '';

        const patchLoadingBubble = (content: string): void => {
          if (streamSettled) return;
          pendingBubbleContent = content;
          if (patchTimer !== null) return;
          patchTimer = setTimeout(() => {
            patchTimer = null;
            if (streamSettled) return;
            const latest = getEducationState(appStore);
            const latestEnsured = ensureConversationState(latest);
            const updatedSessions = updateSessions(
              latestEnsured.conversationSessions,
              nextActiveSession.id,
              (session) => ({
                ...session,
                messages: session.messages.map((message) =>
                  message.id !== loadingMessage.id
                    ? message
                    : { ...message, content: pendingBubbleContent, loading: true, error: '' }
                )
              })
            );
            appStore.setData('hospital', 'DoctorEducationUiState', {
              ...latest,
              conversationLoading: true,
              conversationError: '',
              conversationSessions: updatedSessions
            });
          }, 50);
        };

        await postHospitalAiChatNdjson(
          educationConversationPayload(draft, history, selectedBook, nextActiveSession.id),
          {
            onReady: (data) => {
              if (data && typeof data === 'object' && !Array.isArray(data)) {
                const phase = String((data as Record<string, unknown>).phase ?? '').trim();
                if (phase === 'accepted') {
                  patchLoadingBubble(educationStreamStatusLabel('accepted'));
                }
              }
            },
            onStatus: (phase) => {
              if (!acc.trim()) {
                patchLoadingBubble(educationStreamStatusLabel(phase));
              }
            },
            onDelta: (ch) => {
              acc += ch;
              patchLoadingBubble(
                acc.trim() || educationComposer().t('education.conversation.loadingAnswer')
              );
            },
            onComplete: (data) => {
              streamSettled = true;
              cancelPendingBubblePatch();
              const parsed = extractConversationResponse(data);
              const rawAnswer = parsed.answer || educationComposer().t('education.conversation.emptyAnswer');
              const displayBody = assistantDisplayBody(rawAnswer);
              const finalContent = displayBody.trim() || educationComposer().t('education.conversation.emptyAnswer');
              const followUps =
                parsed.followUpQuestions.length > 0
                  ? parsed.followUpQuestions
                  : assistantDisplayFollowUps(rawAnswer, undefined);
              const latest = getEducationState(appStore);
              const latestEnsured = ensureConversationState(latest);
              const updatedSessions = updateSessions(
                latestEnsured.conversationSessions,
                nextActiveSession.id,
                (session) => ({
                  ...session,
                  title: session.messages.some((message) => message.role === 'user')
                    ? session.title
                    : firstMeaningfulQuestionTitle(draft),
                  updatedAt: new Date().toISOString(),
                  bookName: selectedBook,
                  messages: session.messages.map((message) => {
                    if (message.id !== loadingMessage.id) return message;
                    return {
                      ...message,
                      content: finalContent,
                      loading: false,
                      error: parsed.answer?.trim() ? '' : educationComposer().t('education.conversation.emptyAnswer'),
                      source: parsed.source,
                      chunksUsed: parsed.chunksUsed,
                      followUpQuestions: followUps,
                      images: parsed.images,
                      reference: parsed.reference
                    };
                  })
                })
              );
              appStore.setData('hospital', 'DoctorEducationUiState', {
                ...latest,
                conversationLoading: false,
                conversationError: '',
                conversationSessions: updatedSessions
              });
            }
          },
          typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(180_000)
            : undefined
        );
        return ok();
      } catch (error: unknown) {
        streamSettled = true;
        cancelPendingBubblePatch();
        const timedOut = isRequestTimeoutError(error);
        const exactMessage = localizedConversationError('education.conversation.unavailable', error);
        const latest = getEducationState(appStore);
        const latestEnsured = ensureConversationState(latest);
        const updatedSessions = updateSessions(
          latestEnsured.conversationSessions,
          nextActiveSession.id,
          (session) => ({
            ...session,
            updatedAt: new Date().toISOString(),
            messages: timedOut
              ? session.messages
                .filter((message) => message.id !== loadingMessage.id)
                .map((message) =>
                  message.id === userMessage.id ? { ...message, sendFailedTimeout: true } : message
                )
              : session.messages.map((message) => {
                if (message.id === userMessage.id) {
                  return { ...message, sendFailedTimeout: true };
                }
                if (message.id !== loadingMessage.id) return message;
                return {
                  ...message,
                  content: exactMessage,
                  loading: false,
                  error: exactMessage,
                  followUpQuestions: [],
                  images: [],
                  reference: []
                };
              })
          })
        );
        appStore.setData('hospital', 'DoctorEducationUiState', {
          ...latest,
          conversationLoading: false,
          conversationError: exactMessage,
          conversationSessions: updatedSessions
        });
        const statusErr =
          error && typeof error === 'object' && 'status' in error
            ? Number((error as { status?: number }).status)
            : undefined;
        if (statusErr !== 401) {
          toastStore.show(exactMessage, 'error');
        }
        return { responseCode: 'DOCTOR_EDUCATION_CONVERSATION_FAILED', message: exactMessage };
      }
    }
  }
];
