<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';

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

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { execute } = useActionEngine(props.pageConfig);
const { t } = useI18n();
const appStore = useAppStore(pinia);
const threadRef = ref<HTMLElement | null>(null);
const showConversationControls = ref(false);
const showQuickStarts = ref(true);
const showSavedThreads = ref(false);
const PANEL_PREFS_KEY = 'hospital.doctorEducationConversation.panelPrefs.v1';
const hasLoadedPanelPrefs = ref(false);

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
          followUpQuestions: Array.isArray(msg.followUpQuestions)
            ? msg.followUpQuestions.map((entry) => String(entry ?? '').trim()).filter(Boolean)
            : [],
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

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    const el = threadRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  },
  { immediate: true }
);

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

async function onBookFilterChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  await execute({ actionId: 'set-doctor-education-book', data: { book: value } });
}

async function onModeChange(event: Event) {
  const value = String((event.target as HTMLSelectElement).value ?? '').trim().toLowerCase();
  await execute({
    actionId: 'set-doctor-education-mode',
    data: { mode: value === 'flashcards' ? 'flashcards' : 'conversation' }
  });
}

async function onDraftInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  await execute({ actionId: 'set-doctor-education-conversation-draft', data: { value } });
}

async function startNewConversation() {
  await execute({ actionId: 'start-new-doctor-education-conversation' });
}

async function openConversation(sessionId: string) {
  await execute({ actionId: 'open-doctor-education-conversation', data: { sessionId } });
}

async function setPrompt(prompt: string) {
  await execute({ actionId: 'set-doctor-education-conversation-draft', data: { value: prompt } });
}

async function submitConversation(question?: string) {
  const value = String(question ?? conversationDraft.value).trim();
  if (!value || conversationLoading.value) return;
  await execute({ actionId: 'submit-doctor-education-conversation', data: { question: value } });
}

async function onComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  await submitConversation();
}
</script>

<template>
  <section :id="htmlId" class="rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
    <div class="px-4 py-4 sm:px-5">
      <div class="space-y-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700">
              {{ t('education.conversation.historyTitle') }}
            </p>
            <h3 class="text-xl font-semibold text-slate-900">{{ t('education.conversation.inputLabel') }}</h3>
          </div>

          <div class="flex items-center justify-end">
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
          v-if="hasBooks"
          class="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center"
        >
          <label for="doctor-education-conversation-book" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ t('education.filterBook') }}
          </label>
          <select
            id="doctor-education-conversation-book"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            :value="selectedBook"
            @change="onBookFilterChange"
          >
            <option value="">{{ t('education.allBooks') }}</option>
            <option v-for="book in books" :key="book" :value="book">{{ book }}</option>
          </select>
        </div>

        <div
          v-if="showConversationControls"
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
                      {{ session.messages[session.messages.length - 1]?.content || t('education.conversation.noMessagesYet') }}
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

        <div class="space-y-2">
          <label for="doctor-education-conversation-draft" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {{ t('education.conversation.inputPromptLabel') }}
          </label>
          <textarea
            id="doctor-education-conversation-draft"
            :value="conversationDraft"
            rows="4"
            class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            :placeholder="t('education.conversation.inputPlaceholder')"
            @input="onDraftInput"
            @keydown="onComposerKeydown"
          />
        </div>

        <p v-if="conversationError" class="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {{ conversationError }}
        </p>

        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p class="text-xs leading-5 text-slate-500">{{ t('education.conversation.submitHint') }}</p>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            :disabled="conversationLoading || !conversationDraft.trim()"
            @click="submitConversation()"
          >
            {{ conversationLoading ? t('education.conversation.sending') : t('education.conversation.send') }}
          </button>
        </div>

        <div class="border-t border-slate-200 pt-5">
          <div
            ref="threadRef"
            class="max-h-[32rem] min-h-[18rem] space-y-4 overflow-y-auto"
            role="log"
            aria-live="polite"
          >
            <div v-if="messages.length === 0" class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-600">
              <p class="font-semibold text-slate-900">{{ t('education.conversation.emptyTitle') }}</p>
              <p class="mt-2">{{ t('education.conversation.emptyBody') }}</p>
            </div>

            <template v-for="message in messages" :key="message.id">
              <div v-if="message.role === 'user'" class="flex justify-end">
                <article class="max-w-3xl rounded-3xl bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm">
                  <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    {{ t('education.conversation.userLabel') }}
                  </p>
                  <p class="whitespace-pre-wrap">{{ message.content }}</p>
                </article>
              </div>

              <div v-else class="flex justify-start">
                <article class="max-w-4xl rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                      {{ t('education.conversation.assistantLabel') }}
                    </span>
                    <span
                      v-if="message.source"
                      class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                    >
                      {{ t('education.conversation.sourceChip', { source: message.source }) }}
                    </span>
                    <span
                      v-if="message.chunksUsed"
                      class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                    >
                      {{ t('education.conversation.chunksChip', { count: message.chunksUsed }) }}
                    </span>
                    <span
                      v-if="activeSession?.bookName"
                      class="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                    >
                      {{ activeSession.bookName }}
                    </span>
                  </div>

                  <div
                    v-if="message.loading"
                    class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600"
                  >
                    <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                    <span>{{ t('education.conversation.loadingAnswer') }}</span>
                  </div>
                  <p v-else class="whitespace-pre-wrap text-sm leading-7 text-slate-800">{{ message.content }}</p>

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

                  <div v-if="!message.loading && message.followUpQuestions && message.followUpQuestions.length > 0" class="mt-4 space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('education.conversation.followUpTitle') }}</p>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="followUp in message.followUpQuestions"
                        :key="followUp"
                        type="button"
                        class="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-50"
                        @click="submitConversation(followUp)"
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
      </div>
    </div>
  </section>
</template>
