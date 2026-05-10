<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';

type Flashcard = { id: string; front: string; back: string };
type ExplainerSection = { heading: string; body: string };

/** Turn "1) Foo: bar … 2) Baz: qux" style explainer text into scannable sections. */
function parseExplainerDetail(raw: string): ExplainerSection[] {
  const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const re = /(\d+)\)\s*(.+?):\s*/g;
  const hits: { index: number; end: number; heading: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    hits.push({
      index: m.index,
      end: m.index + m[0].length,
      heading: `${m[1]}) ${m[2].trim()}`
    });
  }
  if (hits.length === 0) return [{ heading: '', body: text }];
  const out: ExplainerSection[] = [];
  for (let i = 0; i < hits.length; i++) {
    const bodyEnd = i + 1 < hits.length ? hits[i + 1].index : text.length;
    const body = text.slice(hits[i].end, bodyEnd).trim();
    out.push({ heading: hits[i].heading, body });
  }
  return out;
}

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { execute } = useActionEngine(props.pageConfig);
const { t } = useI18n();
const appStore = useAppStore(pinia);
const flipped = ref<Set<string>>(new Set());
const selectedCardId = ref<string>('');
const detailMode = ref(false);
const explainerLevel = ref<'MBBS' | 'MD' | 'DM'>('MBBS');

const education = computed(() => {
  return (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as Record<string, unknown>;
});

const topics = computed(() => {
  const raw = education.value.topics;
  return Array.isArray(raw)
    ? raw.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
});

const books = computed(() => {
  const raw = education.value.books;
  return Array.isArray(raw)
    ? raw.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
});

const selectedBook = computed(() => String(education.value.selectedBook ?? '').trim());

const selectedTopic = computed(() => String(education.value.selectedTopic ?? '').trim());
const draftText = computed(() => String(education.value.draftText ?? ''));
const loading = computed(() => Boolean(education.value.loading));
const error = computed(() => String(education.value.error ?? '').trim());
const detailLoadingCardId = computed(() => String(education.value.detailLoadingCardId ?? '').trim());
const detailByCardId = computed(() => {
  const raw = education.value.detailByCardId;
  return raw && typeof raw === 'object' ? (raw as Record<string, string>) : {};
});
const selectedCard = computed<Flashcard | null>(() => {
  const id = selectedCardId.value;
  if (!id) return null;
  return flashcards.value.find((card) => card.id === id) ?? null;
});
const detailLevelGroup = computed<'MBBS' | 'MD' | 'DM'>(() => explainerLevel.value);
const selectedDetailKey = computed(() => {
  if (!selectedCardId.value) return '';
  return `${selectedCardId.value}::${detailLevelGroup.value}`;
});

const flashcards = computed<Flashcard[]>(() => {
  const raw = education.value.flashcards;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const front = String(row.front ?? '').trim();
      const back = String(row.back ?? '').trim();
      if (!front || !back) return null;
      return {
        id: String(row.id ?? `card-${idx + 1}`),
        front,
        back
      };
    })
    .filter((card): card is Flashcard => card !== null);
});

const focusSummary = computed(() => String(education.value.focusSummary ?? '').trim());

const explainerDetailRaw = computed(() => {
  const key = selectedDetailKey.value;
  if (!key) return '';
  return String(detailByCardId.value[key] ?? '').trim();
});

const explainerSections = computed(() => parseExplainerDetail(explainerDetailRaw.value));

/** Same rules as the former debounced generator: need a topic and/or a minimally useful prompt. */
const canSubmitFlashcards = computed(() => {
  const topic = selectedTopic.value.trim();
  const draft = draftText.value.trim();
  if (topic.length > 0) return true;
  return draft.length >= 3;
});

async function onDraftInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  await execute({ actionId: 'set-doctor-education-draft', data: { value } });
}

async function submitFlashcards() {
  const currentDraft = draftText.value.trim();
  const currentTopic = selectedTopic.value.trim();
  if (!currentTopic && currentDraft.length < 3) return;
  flipped.value = new Set();
  await execute({
    actionId: 'generate-doctor-education-flashcards',
    data: { draftText: currentDraft, topic: currentTopic }
  });
}

async function onBookFilterChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  await execute({ actionId: 'set-doctor-education-book', data: { book: value } });
}

async function chooseTopic(topic: string) {
  await execute({ actionId: 'set-doctor-education-topic', data: { topic } });
}

function toggleFlip(cardId: string) {
  const next = new Set(flipped.value);
  if (next.has(cardId)) next.delete(cardId);
  else next.add(cardId);
  flipped.value = next;
}

async function searchCardDetail(card: Flashcard) {
  selectedCardId.value = card.id;
  detailMode.value = true;
  await execute({
    actionId: 'generate-doctor-education-card-detail',
    data: { cardId: card.id, front: card.front, back: card.back, level: explainerLevel.value }
  });
}

function backToFlashcards() {
  detailMode.value = false;
}

async function selectExplainerLevel(level: 'MBBS' | 'MD' | 'DM') {
  explainerLevel.value = level;
  if (!selectedCard.value) return;
  const key = `${selectedCard.value.id}::${level}`;
  if (detailByCardId.value[key]) return;
  await execute({
    actionId: 'generate-doctor-education-card-detail',
    data: {
      cardId: selectedCard.value.id,
      front: selectedCard.value.front,
      back: selectedCard.value.back,
      level
    }
  });
}

onMounted(async () => {
  await execute({ actionId: 'init-doctor-education' });
});

</script>

<template>
  <section
    :id="htmlId"
    class="max-w-full min-w-0 space-y-6 overflow-x-hidden rounded-3xl border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_#f0fdf4,_#ffffff_45%,_#ecfeff_100%)] p-4 shadow-[0_20px_60px_-25px_rgba(16,185,129,0.35)] sm:p-6"
  >
    <div v-if="detailMode" class="explainer-shell">
      <div class="explainer-back-row">
        <button type="button" class="explainer-back-btn" @click="backToFlashcards">{{ t('education.back') }}</button>
      </div>

      <div class="explainer-header">
        <div class="explainer-header-top">
          <div class="explainer-logo">🩺</div>
          <h2 class="explainer-title">{{ t('education.explainer.title') }}</h2>
        </div>
        <p class="explainer-subtitle">{{ t('education.explainer.subtitle') }}</p>
      </div>

      <div class="explainer-level-bar">
        <button
          v-for="lvl in ['MBBS', 'MD', 'DM']"
          :key="lvl"
          type="button"
          class="explainer-level-btn"
          :class="explainerLevel === lvl ? `active-${String(lvl).toLowerCase()}` : ''"
          @click="selectExplainerLevel(lvl as 'MBBS' | 'MD' | 'DM')"
        >
          <span class="level-tag">{{ lvl === 'MD' ? 'MD/DNB' : lvl }}</span>
          <span class="level-desc">
            {{
              lvl === 'MBBS'
                ? t('education.levels.mbbs')
                : lvl === 'MD'
                  ? t('education.levels.md')
                  : t('education.levels.dm')
            }}
          </span>
        </button>
      </div>

      <div class="explainer-input-card">
        <div class="explainer-input-row">
          <div class="explainer-input-group">
            <label class="explainer-label">{{ t('education.explainer.medicalConcept') }}</label>
            <input
              type="text"
              :value="selectedCard?.front ?? draftText"
              readonly
              class="explainer-input"
              :placeholder="t('education.explainer.conceptPlaceholder')"
            />
          </div>
          <div class="explainer-input-group is-wide">
            <label class="explainer-label">{{ t('education.explainer.ragContext') }}</label>
            <div
              class="explainer-context-readonly"
              role="textbox"
              aria-readonly="true"
              :aria-label="t('education.explainer.ragContext')"
            >
              {{
                selectedCard
                  ? `${t('education.front')}: ${selectedCard.front}\n${t('education.backLabel')}: ${selectedCard.back}`
                  : ''
              }}
            </div>
          </div>
        </div>
      </div>

      <div class="explainer-output-card">
        <div class="explainer-output-header">
          <span class="explainer-badge">{{ explainerLevel }}</span>
          <span class="explainer-concept">{{ selectedCard?.front ?? t('education.explainer.selectedConceptDetail') }}</span>
        </div>

        <div v-if="detailLoadingCardId === selectedCardId" class="explainer-loading" aria-live="polite">
          <span class="spinner" />
          {{ t('education.explainer.generatingDetail') }}
        </div>

        <div v-else-if="explainerDetailRaw" class="explainer-output-sections">
          <template v-if="explainerSections.length === 1 && !explainerSections[0].heading">
            <p class="explainer-output-body">{{ explainerSections[0].body }}</p>
          </template>
          <template v-else>
            <section v-for="(sec, idx) in explainerSections" :key="idx" class="explainer-detail-block">
              <h4 v-if="sec.heading" class="explainer-detail-title">{{ sec.heading }}</h4>
              <p class="explainer-detail-text">{{ sec.body }}</p>
            </section>
          </template>
        </div>

        <p v-else class="explainer-output-body explainer-output-placeholder">
          {{ t('education.explainer.noDetailYet') }}
        </p>
      </div>
    </div>

    <template v-else>
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100/80 pb-4">
      <div class="space-y-1">
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">{{ t('education.doctorStudio') }}</p>
        <h2 class="text-3xl font-semibold leading-tight text-slate-900">{{ t('education.flashcardsTitle') }}</h2>
        <p class="text-sm text-slate-600">
          {{ t('education.flashcardsSubtitle') }}
        </p>
      </div>
      <div class="rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-700 backdrop-blur">
        {{ t('education.cardsCount', { count: flashcards.length }) }}
      </div>
    </header>

    <div
      v-if="books.length > 0"
      class="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <label for="doctor-education-book-filter" class="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {{ t('education.filterBook') }}
      </label>
      <select
        id="doctor-education-book-filter"
        class="w-full min-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 sm:ml-auto sm:max-w-md"
        :value="selectedBook"
        @change="onBookFilterChange"
      >
        <option value="">{{ t('education.allBooks') }}</option>
        <option v-for="b in books" :key="b" :value="b">{{ b }}</option>
      </select>
    </div>

    <div class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ t('education.startTopic') }}</p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="topic in topics"
          :key="topic"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200"
          :class="
            selectedTopic === topic
              ? 'border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm'
              : 'border-slate-200 bg-white/80 text-slate-700 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50'
          "
          @click="chooseTopic(topic)"
        >
          {{ topic }}
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <label for="doctor-education-draft" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {{ t('education.addFocus') }}
      </label>
      <textarea
        id="doctor-education-draft"
        :value="draftText"
        rows="4"
        class="w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
        :placeholder="t('education.focusPlaceholder')"
        @input="onDraftInput"
      />
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <button
          type="button"
          class="inline-flex w-full items-center justify-center rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300 disabled:text-slate-600 sm:w-auto sm:min-w-[11rem]"
          :disabled="!canSubmitFlashcards || loading"
          @click="submitFlashcards"
        >
          {{ loading ? t('education.submitFlashcardsLoading') : t('education.submitFlashcards') }}
        </button>
      </div>
      <p class="text-xs text-slate-500">
        {{ t('education.generationHint') }}
      </p>
    </div>

    <div
      v-if="focusSummary"
      class="rounded-2xl border border-teal-100 bg-white/95 p-4 shadow-sm ring-1 ring-emerald-50"
    >
      <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        {{ t('education.focusSummaryTitle') }}
      </p>
      <div class="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ focusSummary }}</div>
    </div>

    <div v-if="loading" aria-live="polite" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div v-for="i in 4" :key="i" class="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
        <div class="mb-2 h-3 w-24 rounded bg-slate-200" />
        <div class="mb-2 h-4 w-5/6 rounded bg-slate-200" />
        <div class="h-4 w-3/5 rounded bg-slate-100" />
      </div>
    </div>

    <p v-if="error" aria-live="polite" class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
      {{ error }}
    </p>

    <div v-if="!loading && flashcards.length > 0" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <article
        v-for="card in flashcards"
        :key="card.id"
        class="rounded-2xl border bg-white/95 p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
        :class="selectedCardId === card.id ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-200'"
      >
        <button
          type="button"
          class="w-full rounded-lg text-left focus:outline-none focus:ring-4 focus:ring-emerald-100"
          @click="toggleFlip(card.id)"
        >
          <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            {{ flipped.has(card.id) ? t('education.backLabel') : t('education.front') }}
          </p>
          <p class="text-sm leading-6 text-slate-800">
            {{ flipped.has(card.id) ? card.back : card.front }}
          </p>
        </button>

        <div class="mt-3 flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            :disabled="detailLoadingCardId === card.id"
            @click="searchCardDetail(card)"
          >
            {{ detailLoadingCardId === card.id ? t('education.searching') : t('education.searchInDetail') }}
          </button>
        </div>

        <div
          v-if="detailByCardId[card.id]"
          class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          aria-live="polite"
        >
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{{ t('education.detailedNotes') }}</p>
          <p class="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {{ detailByCardId[card.id] }}
          </p>
        </div>
      </article>
    </div>

    <p v-if="!loading && !error && flashcards.length === 0" class="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-500">
      {{ t('education.emptyState') }}
    </p>
    </template>
  </section>
</template>

<style scoped>
.explainer-shell {
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 14px;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  box-shadow: 0 12px 40px -20px rgba(15, 118, 110, 0.25);
}
@media (min-width: 640px) {
  .explainer-shell {
    padding: 18px;
  }
}
.explainer-back-row {
  margin-bottom: 14px;
}
.explainer-back-btn {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #334155;
  border-radius: 10px;
  font-size: 12px;
  padding: 6px 10px;
}
.explainer-back-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.explainer-header {
  margin-bottom: 18px;
}
.explainer-header-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.explainer-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #a7f3d0, #6ee7b7);
  border: 1px solid #d1fae5;
}
.explainer-title {
  font-size: clamp(16px, 4.5vw, 20px);
  font-weight: 800;
  line-height: 1.25;
  word-break: break-word;
  color: #0f172a;
}
.explainer-subtitle {
  font-size: 11px;
  color: #64748b;
  line-height: 1.45;
}
.explainer-level-bar {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 16px;
}
@media (min-width: 640px) {
  .explainer-level-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
}
.explainer-level-btn {
  text-align: left;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fafafa;
  color: #0f172a;
  padding: 12px 10px;
  min-width: 0;
  width: 100%;
}
.explainer-level-btn:hover {
  border-color: #cbd5e1;
  background: #ffffff;
}
.explainer-level-btn.active-mbbs {
  border-color: #38bdf8;
  background: #f0f9ff;
}
.explainer-level-btn.active-md {
  border-color: #34d399;
  background: #ecfdf5;
}
.explainer-level-btn.active-dnb {
  border-color: #fb923c;
  background: #fff7ed;
}
.explainer-level-btn.active-dm {
  border-color: #c084fc;
  background: #faf5ff;
}
.level-tag {
  display: block;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-bottom: 3px;
  color: #0f172a;
}
.level-desc {
  display: block;
  font-size: 11px;
  line-height: 1.45;
  color: #475569;
  overflow-wrap: anywhere;
  word-break: normal;
  hyphens: auto;
}
.explainer-input-card,
.explainer-output-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px;
}
.explainer-input-card {
  margin-bottom: 14px;
}
.explainer-input-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.explainer-input-group {
  flex: 1 1 100%;
  min-width: 0;
}
@media (min-width: 640px) {
  .explainer-input-group {
    flex: 1;
    min-width: 170px;
  }
  .explainer-input-group.is-wide {
    flex: 1.5;
    min-width: 0;
  }
}
.explainer-label {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1.4px;
}
.explainer-input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
}
.explainer-context-readonly {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-height: 88px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #1e293b;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.explainer-output-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
@media (min-width: 640px) {
  .explainer-output-header {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
}
.explainer-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid #99f6e4;
  color: #0f766e;
  background: #ccfbf1;
  border-radius: 6px;
  padding: 4px 10px;
}
.explainer-concept {
  font-size: 15px;
  font-weight: 700;
  min-width: 0;
  width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
  color: #0f172a;
}
.explainer-output-body {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #334155;
  font-size: 13px;
}
.explainer-output-placeholder {
  color: #94a3b8;
  font-style: italic;
}
.explainer-output-sections {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.explainer-detail-block {
  margin: 0;
  padding: 12px 12px 12px 14px;
  border-left: 3px solid #99f6e4;
  border-radius: 0 10px 10px 0;
  background: #ffffff;
  border-top: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
}
.explainer-detail-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #0f766e;
  letter-spacing: 0.02em;
}
.explainer-detail-text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.75;
  color: #334155;
  font-size: 13px;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.explainer-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 12px;
}
.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #e2e8f0;
  border-top-color: #059669;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

