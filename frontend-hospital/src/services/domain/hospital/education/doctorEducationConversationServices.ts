import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import type { Composer } from 'vue-i18n';
import type { AxiosResponse } from 'axios';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { i18n } from '../../../../i18n';
import { apiClient } from '../../../http/apiClient';
import { isRequestTimeoutError, requestTimeoutMessage } from '../../../http/httpUserFacingErrors';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';

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
    followUpQuestions: Array.isArray(row.followUpQuestions)
      ? row.followUpQuestions.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [],
    images: imagesRaw
      .map((item, idx) => normalizeConversationFigure(item, idx))
      .filter((item): item is ConversationFigure => item !== null)
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

function extractConversationResponse(data: Record<string, unknown>): {
  answer: string;
  source: string;
  chunksUsed?: number;
  followUpQuestions: string[];
  images: ConversationFigure[];
} {
  const rawFollowUps = data.followUpQuestions ?? data.follow_up_questions ?? data.FollowUpQuestions;
  const followUpQuestions = Array.isArray(rawFollowUps)
    ? rawFollowUps.map((item) => String(item ?? '').trim()).filter(Boolean).slice(0, 6)
    : [];
  const rawImages = data.images ?? data.Images;
  const images = Array.isArray(rawImages)
    ? rawImages
      .map((item, index) => normalizeConversationFigure(item, index))
      .filter((item): item is ConversationFigure => item !== null)
    : [];
  const chunksUsed = Number(data.chunksUsed ?? data.ChunksUsed ?? 0) || undefined;
  return {
    answer: String(data.reply ?? data.message ?? '').trim(),
    source: String(data.source ?? data.Source ?? data.mode ?? '').trim(),
    chunksUsed,
    followUpQuestions,
    images
  };
}

function buildConversationHistory(session: ConversationSession): Array<{ role: 'user' | 'assistant'; content: string }> {
  return session.messages
    .filter((message) => !message.loading && !message.error && String(message.content ?? '').trim())
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? '').trim()
    }));
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
      const hadPriorUserTurns = activeSession.messages.some((message) => message.role === 'user');
      const nextActiveSession: ConversationSession = {
        ...activeSession,
        title: hadPriorUserTurns ? activeSession.title : firstMeaningfulQuestionTitle(draft),
        updatedAt: new Date().toISOString(),
        bookName: selectedBook,
        messages: [...activeSession.messages, userMessage, loadingMessage]
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

      try {
        const history = buildConversationHistory(nextActiveSession);
        const response = await apiClient.post(
          URLRegistry.paths.hospitalAiChat,
          educationConversationPayload(draft, history, selectedBook, nextActiveSession.id)
        );
        const data = readHospitalEnvelopeData<Record<string, unknown>>(response)
          ?? ((response.data ?? {}) as Record<string, unknown>);
        const parsed = extractConversationResponse(data);
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
                content: parsed.answer || educationComposer().t('education.conversation.emptyAnswer'),
                loading: false,
                error: parsed.answer ? '' : educationComposer().t('education.conversation.emptyAnswer'),
                source: parsed.source,
                chunksUsed: parsed.chunksUsed,
                followUpQuestions: parsed.followUpQuestions,
                images: parsed.images
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
        return ok();
      } catch (error: unknown) {
        const exactMessage = localizedConversationError('education.conversation.unavailable', error);
        const latest = getEducationState(appStore);
        const latestEnsured = ensureConversationState(latest);
        const updatedSessions = updateSessions(
          latestEnsured.conversationSessions,
          nextActiveSession.id,
          (session) => ({
            ...session,
            updatedAt: new Date().toISOString(),
            messages: session.messages.map((message) => {
              if (message.id !== loadingMessage.id) return message;
              return {
                ...message,
                content: exactMessage,
                loading: false,
                error: exactMessage,
                followUpQuestions: [],
                images: []
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
        toastStore.show(exactMessage, 'error');
        return { responseCode: 'DOCTOR_EDUCATION_CONVERSATION_FAILED', message: exactMessage };
      }
    }
  }
];
