<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';

type Flashcard = { id: string; front: string; back: string };

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { execute } = useActionEngine(props.pageConfig);
const appStore = useAppStore(pinia);
const flipped = ref<Set<string>>(new Set());
const selectedCardId = ref<string>('');
const detailMode = ref(false);
const explainerLevel = ref<'MBBS' | 'MD' | 'DM'>('MBBS');
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let generationSeq = 0;

const education = computed(() => {
  return (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as Record<string, unknown>;
});

const topics = computed(() => {
  const raw = education.value.topics;
  return Array.isArray(raw)
    ? raw.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
});

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

function scheduleGeneration() {
  if (debounceTimer) clearTimeout(debounceTimer);
  const seq = ++generationSeq;
  debounceTimer = setTimeout(async () => {
    const currentDraft = String(draftText.value ?? '').trim();
    const currentTopic = String(selectedTopic.value ?? '').trim();
    if (!currentDraft && !currentTopic) return;
    if (!currentTopic && currentDraft.length < 3) return;
    if (seq !== generationSeq) return;
    await execute({
      actionId: 'generate-doctor-education-flashcards',
      data: { draftText: currentDraft, topic: currentTopic }
    });
    flipped.value = new Set();
  }, 850);
}

async function onDraftInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  await execute({ actionId: 'set-doctor-education-draft', data: { value } });
  scheduleGeneration();
}

async function chooseTopic(topic: string) {
  await execute({ actionId: 'set-doctor-education-topic', data: { topic } });
  await execute({
    actionId: 'generate-doctor-education-flashcards',
    data: {
      topic,
      draftText: String((appStore.getData('hospital', 'DoctorEducationUiState') as Record<string, unknown> | undefined)?.draftText ?? '')
    }
  });
  flipped.value = new Set();
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
  await execute({ actionId: 'set-doctor-education-draft', data: { value: card.front } });
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

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <section
    :id="htmlId"
    class="space-y-6 rounded-3xl border border-emerald-100 bg-[radial-gradient(circle_at_top_left,_#f0fdf4,_#ffffff_45%,_#ecfeff_100%)] p-4 shadow-[0_20px_60px_-25px_rgba(16,185,129,0.35)] sm:p-6"
  >
    <div v-if="detailMode" class="explainer-shell">
      <div class="explainer-back-row">
        <button type="button" class="explainer-back-btn" @click="backToFlashcards">← Back</button>
      </div>

      <div class="explainer-header">
        <div class="explainer-header-top">
          <div class="explainer-logo">🩺</div>
          <h2 class="explainer-title">Medical Concept Explainer</h2>
        </div>
        <p class="explainer-subtitle">Adaptive explanations calibrated for MBBS → MD/DNB → DM</p>
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
                ? 'Foundational concepts and first principles'
                : lvl === 'MD'
                  ? 'Mechanisms, depth, evidence-based framing and clinical nuance'
                  : 'Super-specialist depth and edge-case analysis'
            }}
          </span>
        </button>
      </div>

      <div class="explainer-input-card">
        <div class="explainer-input-row">
          <div class="explainer-input-group">
            <label class="explainer-label">Medical Concept</label>
            <input
              type="text"
              :value="selectedCard?.front ?? draftText"
              readonly
              class="explainer-input"
              placeholder="Concept"
            />
          </div>
          <div class="explainer-input-group is-wide">
            <label class="explainer-label">RAG Context / Flashcard Context</label>
            <textarea
              readonly
              class="explainer-textarea"
              :value="selectedCard ? `Front: ${selectedCard.front}\nBack: ${selectedCard.back}` : ''"
            />
          </div>
        </div>
      </div>

      <div class="explainer-output-card">
        <div class="explainer-output-header">
          <span class="explainer-badge">{{ explainerLevel }}</span>
          <span class="explainer-concept">{{ selectedCard?.front ?? 'Selected concept detail' }}</span>
        </div>

        <div v-if="detailLoadingCardId === selectedCardId" class="explainer-loading" aria-live="polite">
          <span class="spinner" />
          Generating detailed explanation...
        </div>

        <p
          v-else
          class="explainer-output-body"
        >
          {{
            detailByCardId[selectedDetailKey]
              || 'No detailed notes yet. Use Search in detail from a card to generate this view.'
          }}
        </p>
      </div>
    </div>

    <template v-else>
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100/80 pb-4">
      <div class="space-y-1">
        <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-700">Doctor Studio</p>
        <h2 class="text-3xl font-semibold leading-tight text-slate-900">Education Flashcards</h2>
        <p class="text-sm text-slate-600">
          Pick a topic or type your focus area. Cards are generated in a clinical learning format.
        </p>
      </div>
      <div class="rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-700 backdrop-blur">
        {{ flashcards.length }} cards
      </div>
    </header>

    <div class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Start with a key topic</p>
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
        Add your focus
      </label>
      <textarea
        id="doctor-education-draft"
        :value="draftText"
        rows="4"
        class="w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
        placeholder="Example: Build flashcards on pediatric fever workup with red flags and initial investigations."
        @input="onDraftInput"
      />
      <p class="text-xs text-slate-500">
        Generation runs automatically after a brief typing pause. Clicking <span class="font-semibold text-emerald-700">Search in detail</span>
        copies that card topic here.
      </p>
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
            {{ flipped.has(card.id) ? 'Back' : 'Front' }}
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
            {{ detailLoadingCardId === card.id ? 'Searching…' : 'Search in detail' }}
          </button>
        </div>

        <div
          v-if="detailByCardId[card.id]"
          class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          aria-live="polite"
        >
          <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Detailed notes</p>
          <p class="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {{ detailByCardId[card.id] }}
          </p>
        </div>
      </article>
    </div>

    <p v-if="!loading && !error && flashcards.length === 0" class="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-500">
      Choose a topic or type a prompt to generate study cards.
    </p>
    </template>
  </section>
</template>

<style scoped>
.explainer-shell {
  background: #060910;
  color: #dde4f0;
  border: 1px solid #1e2535;
  border-radius: 18px;
  padding: 18px;
}
.explainer-back-row {
  margin-bottom: 14px;
}
.explainer-back-btn {
  border: 1px solid #1e2535;
  background: #0e1117;
  color: #c8d4e8;
  border-radius: 10px;
  font-size: 12px;
  padding: 6px 10px;
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
  background: linear-gradient(135deg, #4fc3f7, #ce93d8);
}
.explainer-title {
  font-size: 20px;
  font-weight: 800;
}
.explainer-subtitle {
  font-size: 11px;
  color: #5a6a8a;
}
.explainer-level-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}
.explainer-level-btn {
  text-align: left;
  border: 1px solid #1e2535;
  border-radius: 10px;
  background: #0e1117;
  padding: 10px 8px;
}
.explainer-level-btn.active-mbbs {
  border-color: #4fc3f7;
  background: rgba(79, 195, 247, 0.08);
}
.explainer-level-btn.active-md {
  border-color: #81c784;
  background: rgba(129, 199, 132, 0.08);
}
.explainer-level-btn.active-dnb {
  border-color: #ffb74d;
  background: rgba(255, 183, 77, 0.08);
}
.explainer-level-btn.active-dm {
  border-color: #ce93d8;
  background: rgba(206, 147, 216, 0.08);
}
.level-tag {
  display: block;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-bottom: 3px;
}
.level-desc {
  font-size: 10px;
  color: #5a6a8a;
}
.explainer-input-card,
.explainer-output-card {
  background: #0e1117;
  border: 1px solid #1e2535;
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
  flex: 1;
  min-width: 170px;
}
.explainer-input-group.is-wide {
  flex: 1.5;
}
.explainer-label {
  display: block;
  margin-bottom: 6px;
  font-size: 10px;
  color: #5a6a8a;
  text-transform: uppercase;
  letter-spacing: 1.4px;
}
.explainer-input,
.explainer-textarea {
  width: 100%;
  border: 1px solid #1e2535;
  background: #161b24;
  color: #dde4f0;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12px;
}
.explainer-textarea {
  min-height: 72px;
}
.explainer-output-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #1e2535;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
.explainer-badge {
  font-size: 11px;
  font-weight: 800;
  border: 1px solid rgba(79, 195, 247, 0.3);
  color: #4fc3f7;
  background: rgba(79, 195, 247, 0.08);
  border-radius: 6px;
  padding: 4px 10px;
}
.explainer-concept {
  font-size: 15px;
  font-weight: 700;
}
.explainer-output-body {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #c8d4e8;
  font-size: 13px;
}
.explainer-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #9aaac0;
  font-size: 12px;
}
.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #1e2535;
  border-top-color: #4fc3f7;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

