import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import type { AxiosResponse } from 'axios';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { isRequestTimeoutError, requestTimeoutMessage } from '../../../http/httpUserFacingErrors';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';

type Flashcard = { id: string; front: string; back: string };
type EducationState = {
  loading?: boolean;
  error?: string;
  draftText?: string;
  selectedTopic?: string;
  topics?: string[];
  books?: string[];
  selectedBook?: string;
  /** Short clinical summary of the focus text, produced before flashcards in one model response. */
  focusSummary?: string;
  flashcards?: Flashcard[];
  aiRawReply?: string;
  detailByCardId?: Record<string, string>;
  detailLoadingCardId?: string;
};

const EDU_CATALOG_CACHE_TTL_MS = 15 * 60 * 1000;
const SS_EDU_BOOKS_KEY = 'agastya.edu.catalog.v1.books';
const SS_EDU_TOPICS_PREFIX = 'agastya.edu.catalog.v1.topics.';

function topicsCacheKey(book: string): string {
  const seg = book.trim() === '' ? '_all' : book.trim().slice(0, 240);
  return `${SS_EDU_TOPICS_PREFIX}${seg}`;
}

function readSessionJson<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeSessionJson(key: string, payload: unknown): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

function isFresh(ts: number): boolean {
  return Number.isFinite(ts) && Date.now() - ts < EDU_CATALOG_CACHE_TTL_MS;
}

type BooksCacheRow = { ts: number; books: string[] };
type TopicsCacheRow = { ts: number; topics: string[] };

function readBooksCache(): BooksCacheRow | null {
  const row = readSessionJson<BooksCacheRow>(SS_EDU_BOOKS_KEY);
  if (!row || !Array.isArray(row.books)) return null;
  return row;
}

function writeBooksCache(books: string[]): void {
  writeSessionJson(SS_EDU_BOOKS_KEY, { ts: Date.now(), books });
}

function readTopicsCache(book: string): TopicsCacheRow | null {
  const row = readSessionJson<TopicsCacheRow>(topicsCacheKey(book));
  if (!row || !Array.isArray(row.topics)) return null;
  return row;
}

function writeTopicsCache(book: string, topics: string[]): void {
  writeSessionJson(topicsCacheKey(book), { ts: Date.now(), topics });
}

function readHospitalEnvelopeData<T>(response: AxiosResponse<unknown>): T | null {
  const root = response.data as Record<string, unknown> | undefined;
  if (!root) return null;
  const ok = Boolean(root.Success ?? root.success);
  if (!ok) return null;
  return (root.Data ?? root.data) as T;
}

function hospitalEducationKeyTopicsUrl(book: string, limit: number): string {
  const params = new URLSearchParams();
  params.set('Limit', String(limit));
  const trimmed = book.trim();
  if (trimmed) params.set('BookName', trimmed);
  return `${URLRegistry.resolve('hospitalEducationKeyTopics')}?${params.toString()}`;
}

async function fetchEducationBooksFromApi(): Promise<string[]> {
  const response = await apiClient.get(URLRegistry.paths.hospitalEducationBooks);
  const data = readHospitalEnvelopeData<{ Books?: string[]; books?: string[] }>(response);
  const raw = data?.Books ?? data?.books ?? [];
  return Array.isArray(raw)
    ? raw.map((b) => String(b ?? '').trim()).filter(Boolean)
    : [];
}

async function fetchEducationTopicsFromApi(book: string, limit: number): Promise<string[]> {
  const response = await apiClient.get(hospitalEducationKeyTopicsUrl(book, limit));
  const data = readHospitalEnvelopeData<{
    KeyTopics?: Array<{ Label?: string; label?: string }>;
    keyTopics?: Array<{ Label?: string; label?: string }>;
  }>(response);
  const rows = data?.KeyTopics ?? data?.keyTopics ?? [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => String(r?.Label ?? r?.label ?? '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

async function resolveBooksCached(): Promise<string[]> {
  const cached = readBooksCache();
  if (cached && isFresh(cached.ts)) {
    return cached.books;
  }
  try {
    const books = await fetchEducationBooksFromApi();
    writeBooksCache(books);
    return books;
  } catch {
    return cached?.books?.length ? cached.books : [];
  }
}

async function resolveTopicsCached(book: string, limit = 5): Promise<string[]> {
  const cached = readTopicsCache(book);
  if (cached && isFresh(cached.ts)) {
    return cached.topics.slice(0, limit);
  }
  try {
    const topics = await fetchEducationTopicsFromApi(book, limit);
    writeTopicsCache(book, topics);
    return topics;
  } catch {
    return cached?.topics?.length ? cached.topics.slice(0, limit) : [];
  }
}

const DEPARTMENT_TOPICS: Record<string, string[]> = {
  pediatrics: [
    'Neonatal jaundice early recognition',
    'Common pediatric respiratory infections',
    'Childhood immunization counseling',
    'Pediatric fever red flags',
    'Growth and developmental milestones'
  ],
  cardiology: [
    'Acute coronary syndrome essentials',
    'Hypertension stepwise management',
    'Heart failure medication pearls',
    'Atrial fibrillation rate vs rhythm control',
    'ECG interpretation quick review'
  ],
  dermatology: [
    'Eczema diagnosis and management',
    'Psoriasis treatment ladder',
    'Acne severity based therapy',
    'Skin infection differentials',
    'Dermatology red flags for referral'
  ],
  neurology: [
    'Stroke first-hour protocol',
    'Headache differential diagnosis',
    'Seizure classification and first-line treatment',
    'Neurological exam high-yield approach',
    'Peripheral neuropathy workup'
  ],
  orthopedics: [
    'Fracture initial assessment',
    'Low back pain red flags',
    'Osteoarthritis evidence-based care',
    'Sports injury triage',
    'Post-op rehabilitation essentials'
  ],
  gynecology: [
    'Abnormal uterine bleeding algorithm',
    'PCOS clinical management',
    'Antenatal warning signs counseling',
    'Contraception method selection',
    'Menopause symptom management'
  ],
  ent: [
    'Otitis media decision making',
    'Sinusitis diagnosis and treatment',
    'Vertigo differential diagnosis',
    'Epistaxis acute management',
    'Hearing loss evaluation flow'
  ],
  psychiatry: [
    'Depression screening and treatment plan',
    'Anxiety disorders practical management',
    'Suicide risk triage',
    'Sleep disorders quick framework',
    'Medication adherence strategies'
  ]
};

const FALLBACK_TOPICS = [
  'Differential diagnosis framework',
  'Evidence-based treatment pathways',
  'Patient counseling best practices',
  'Clinical red flags and escalation',
  'Follow-up and monitoring plans'
];

function getEducationState(appStore: ReturnType<typeof useAppStore>): EducationState {
  return (appStore.getData('hospital', 'DoctorEducationUiState') ?? {}) as EducationState;
}

function normalizeDepartment(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

function topicsForDepartment(rawDepartment: unknown): string[] {
  const dep = normalizeDepartment(rawDepartment);
  if (!dep) return FALLBACK_TOPICS;
  for (const [key, topics] of Object.entries(DEPARTMENT_TOPICS)) {
    if (dep.includes(key)) return topics;
  }
  return [
    `${String(rawDepartment).trim()} high-yield revision`,
    `${String(rawDepartment).trim()} emergency red flags`,
    `${String(rawDepartment).trim()} diagnostic checklist`,
    ...FALLBACK_TOPICS.slice(0, 2)
  ];
}

function buildEducationPrompt(params: {
  department: string;
  topic: string;
  freeText: string;
  cardCount?: number;
  selectedBook?: string;
}): string {
  const cardCount = Math.max(4, Math.min(12, Number(params.cardCount ?? 8)));
  const department = params.department.trim() || 'General Medicine';
  const topic = params.topic.trim() || 'Clinical education';
  const focus = params.freeText.trim() || topic;
  const book = String(params.selectedBook ?? '').trim();
  const bookLines = book
    ? [`Ingested reference corpus filter (when clinically reasonable, align wording with this book): "${book}".`]
    : [];
  return [
    `You are creating flashcards for a DOCTOR education module.`,
    `Department: ${department}`,
    `Primary topic: ${topic}`,
    `Extra focus from doctor: ${focus}`,
    ...bookLines,
    '',
    'First produce a SUMMARY of the clinical focus at guideline depth (same substance you would put in a sourced teaching overview), then produce the flashcards.',
    'SUMMARY rules:',
    '- Start with a line that contains only the word SUMMARY (capital letters).',
    '- Next lines: 4-8 bullet points (each starting with "- "), each under 280 characters.',
    '- Include concrete management detail when the retrieved sources support it: drug classes and named agents, indications, pediatric age cautions, counselling/education points, follow-up thresholds—not vague high-level phrases.',
    '',
    `Then produce exactly ${cardCount} flashcards for clinical learning.`,
    'Each flashcard should be practical and medically accurate; prefer wording aligned with the referenced guideline/source.',
    'Keep each Front under 18 words and each Back under 120 words so backs can carry specifics (agents, caveats, durations) from context.',
    'Do not include disclaimers, markdown tables, or extra commentary.',
    '',
    'After the summary bullets, start the flashcard block with a single line containing only CARDS (capital letters).',
    '',
    'Full plain-text shape (must match):',
    'SUMMARY',
    '- ...',
    '- ...',
    '',
    'CARDS',
    'Card 1',
    'Front: ...',
    'Back: ...',
    'Card 2',
    'Front: ...',
    'Back: ...'
  ].join('\n');
}

function buildCardDetailPrompt(params: {
  department: string;
  topic: string;
  front: string;
  back: string;
  level?: string;
}): string {
  const department = params.department.trim() || 'General Medicine';
  const topic = params.topic.trim() || 'Clinical education';
  const level = String(params.level ?? 'MBBS').trim().toUpperCase();
  const levelGroup = level === 'DNB' ? 'MD' : level;
  const depthDirective =
    levelGroup === 'MBBS'
      ? [
          'Depth target: MBBS first-level clarity.',
          'Keep explanations concise, high-yield, and foundational.',
          'Prefer first principles, recognition clues, and essential next steps.'
        ]
      : levelGroup === 'DM'
        ? [
            'Depth target: DM super-specialist depth.',
            'Include advanced mechanisms, nuanced differentials, and deeper management subtleties.',
            'Highlight controversies/edge cases where relevant.'
          ]
        : [
            'Depth target: MD/DNB advanced single-card depth.',
            'Provide richer clinical detail than MBBS, but keep structure concise and practical.',
            'Include stronger workup and management nuance.'
          ];
  return [
    'You are an education copilot for doctors.',
    `Audience level: ${levelGroup}`,
    `Department: ${department}`,
    `Current topic: ${topic}`,
    '',
    'The user selected this flashcard and wants deeper explanation.',
    `Front: ${params.front.trim()}`,
    `Back: ${params.back.trim()}`,
    '',
    'Return a concise but detailed expansion with numbered sections using this exact pattern on one line each:',
    '1) Clinical significance: [paragraph]',
    '2) Pathophysiology or mechanism: [paragraph]',
    '3) Workup/assessment points: [paragraph]',
    '4) Management pearls: [paragraph]',
    '5) Pitfalls/red flags: [paragraph]',
    '',
    'Put a blank line between each numbered section so the reader can scan easily.',
    '',
    ...depthDirective,
    '',
    'Keep it practical and evidence-aligned. No markdown tables.'
  ].join('\n');
}

function normalizeLevelGroup(raw: unknown): 'MBBS' | 'MD' | 'DM' {
  const level = String(raw ?? 'MBBS').trim().toUpperCase();
  if (level === 'DNB' || level === 'MD') return 'MD';
  if (level === 'DM') return 'DM';
  return 'MBBS';
}

function parseFlashcards(reply: string): Flashcard[] {
  const cards: Flashcard[] = [];
  const normalized = String(reply ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return cards;
  // Primary parser: tolerant to inline output like
  // "Card 1 Front: ... Back: ... Card 2 Front: ... Back: ..."
  const inlinePattern =
    /Card\s*(\d+)\s*[:\-]?\s*Front:\s*([\s\S]*?)\s*Back:\s*([\s\S]*?)(?=\s*Card\s*\d+\s*[:\-]?\s*Front:|$)/gi;
  for (const match of normalized.matchAll(inlinePattern)) {
    const index = Number(match[1] ?? 0);
    const front = String(match[2] ?? '').trim();
    const back = String(match[3] ?? '').trim();
    if (!front || !back) continue;
    cards.push({ id: `card-${index || cards.length + 1}`, front, back });
  }

  // Secondary parser for line-broken variants where Card/Front/Back are on separate lines.
  if (cards.length === 0) {
    const blocks = normalized.split(/(?=Card\s+\d+)/i);
    for (const block of blocks) {
      const cardMatch = block.match(/Card\s+(\d+)/i);
      const frontMatch = block.match(/Front:\s*([\s\S]*?)(?=\s*Back:|$)/i);
      const backMatch = block.match(/Back:\s*([\s\S]*)/i);
      if (!cardMatch || !frontMatch || !backMatch) continue;
      const index = Number(cardMatch[1]);
      const front = frontMatch[1].trim();
      const back = backMatch[1].trim();
      if (!front || !back) continue;
      cards.push({ id: `card-${index}`, front, back });
    }
  }

  if (cards.length > 0) return cards;

  const fallback = normalized.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8);
  if (fallback.length === 0) return cards;
  return fallback.map((line, idx) => ({
    id: `fallback-${idx + 1}`,
    front: `Study Point ${idx + 1}`,
    back: line
  }));
}

/** Split model reply into SUMMARY bullets block and flashcard block (single API round-trip). */
function parseSummaryAndFlashcards(reply: string): { summary: string; cards: Flashcard[] } {
  const normalized = String(reply ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return { summary: '', cards: [] };

  let summaryText = '';
  let cardsText = normalized;

  const cardParts = normalized.split(/\n\s*CARDS\s*\n/i);
  if (cardParts.length >= 2) {
    summaryText = cardParts[0].replace(/^\s*SUMMARY\s*\n?/i, '').trim();
    cardsText = cardParts.slice(1).join('\nCARDS\n').trim();
  } else {
    const soft = normalized.match(/^\s*SUMMARY\s*\n([\s\S]*?)(?=\n\s*Card\s*\d+)/i);
    if (soft) {
      summaryText = soft[1].trim();
      cardsText = normalized.slice((soft.index ?? 0) + soft[0].length).trim();
    }
  }

  let cards = parseFlashcards(cardsText);
  if (cards.length === 0) {
    cards = parseFlashcards(normalized);
  }
  return { summary: summaryText, cards };
}

const RETRIEVAL_QUESTION_MAX = 2000;

/**
 * Short clinical query for pdf-rag retrieval only — avoids vector / FTS noise from long flashcard instructions.
 * Matches how `/api/v1/query` is typically called with a plain topic string.
 */
function buildEducationRetrievalSeed(topic: string, freeText: string): string {
  const topicTrim = topic.trim();
  const focusTrim = freeText.trim();
  const genericTopic = /^clinical\s+education$/i.test(topicTrim);
  if (!topicTrim && focusTrim) return focusTrim.slice(0, RETRIEVAL_QUESTION_MAX);
  if (genericTopic && focusTrim) return focusTrim.slice(0, RETRIEVAL_QUESTION_MAX);
  if (!focusTrim) return topicTrim.slice(0, RETRIEVAL_QUESTION_MAX);
  if (!topicTrim) return focusTrim.slice(0, RETRIEVAL_QUESTION_MAX);
  if (focusTrim.toLowerCase().includes(topicTrim.toLowerCase())) {
    return focusTrim.slice(0, RETRIEVAL_QUESTION_MAX);
  }
  return `${topicTrim}. ${focusTrim}`.slice(0, RETRIEVAL_QUESTION_MAX);
}

function buildCardDetailRetrievalSeed(topic: string, front: string, back: string): string {
  const parts = [topic, front, back].map((s) => String(s ?? '').trim()).filter(Boolean);
  return parts.join(' — ').slice(0, RETRIEVAL_QUESTION_MAX);
}

/** Forwards optional corpus scope to Spring `/api/hospital/ai/chat` → pdf-rag `BookName` / `RetrievalQuestion`. */
function hospitalAiChatPayload(
  message: string,
  history: unknown[],
  bookName: string,
  retrievalQuestion?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = { message, history };
  const bn = bookName.trim();
  if (bn) payload.BookName = bn;
  const rq = String(retrievalQuestion ?? '').trim();
  if (rq) payload.RetrievalQuestion = rq.slice(0, RETRIEVAL_QUESTION_MAX);
  return payload;
}

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (isRequestTimeoutError(err)) {
    return requestTimeoutMessage();
  }
  if (isAxiosError(err)) {
    const payload = (err.response?.data ?? {}) as Record<string, unknown>;
    const exact =
      String(payload.Message ?? '').trim()
      || String(payload.message ?? '').trim()
      || String(err.message ?? '').trim();
    return exact || fallback;
  }
  return fallback;
}

export const doctorEducationHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-doctor-education',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const department = String(auth.department ?? '').trim();
      const fallbackTopics = topicsForDepartment(department);
      const prev = getEducationState(appStore);

      const books = await resolveBooksCached();
      let selectedBook = String(prev.selectedBook ?? '').trim();
      if (selectedBook && !books.includes(selectedBook)) {
        selectedBook = '';
      }

      const catalogTopics = await resolveTopicsCached(selectedBook, 5);
      const topics = catalogTopics.length > 0 ? catalogTopics : fallbackTopics;
      const prevTopic = String(prev.selectedTopic ?? '').trim();
      const selectedTopic =
        prevTopic && topics.includes(prevTopic) ? prevTopic : '';

      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        loading: false,
        error: '',
        books,
        selectedBook,
        topics,
        selectedTopic,
        draftText: String(prev.draftText ?? '').trim(),
        focusSummary: '',
        flashcards: Array.isArray(prev.flashcards) ? prev.flashcards : [],
        aiRawReply: String(prev.aiRawReply ?? ''),
        detailByCardId: typeof prev.detailByCardId === 'object' && prev.detailByCardId ? prev.detailByCardId : {},
        detailLoadingCardId: ''
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-doctor-education-book',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const prev = getEducationState(appStore);
      const department = String(auth.department ?? '').trim();
      const fallbackTopics = topicsForDepartment(department);
      const requested = String(request.data?.book ?? '').trim();

      const books =
        Array.isArray(prev.books) && prev.books.length > 0 ? prev.books : await resolveBooksCached();
      let selectedBook = requested;
      if (selectedBook && !books.includes(selectedBook)) {
        selectedBook = '';
      }

      const catalogTopics = await resolveTopicsCached(selectedBook, 5);
      const topics = catalogTopics.length > 0 ? catalogTopics : fallbackTopics;
      const prevTopic = String(prev.selectedTopic ?? '').trim();
      const selectedTopic = prevTopic && topics.includes(prevTopic) ? prevTopic : '';

      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        books,
        selectedBook,
        topics,
        selectedTopic,
        focusSummary: '',
        error: ''
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-doctor-education-draft',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        draftText: String(request.data?.value ?? ''),
        focusSummary: '',
        error: ''
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-doctor-education-topic',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      const nextTopic = String(request.data?.topic ?? '').trim();
      if (!nextTopic) return ok();
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        selectedTopic: nextTopic,
        focusSummary: '',
        error: '',
        draftText: String(prev.draftText ?? '').trim() || nextTopic
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'generate-doctor-education-flashcards',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(auth.role ?? '').trim().toUpperCase();
      if (role !== 'DOCTOR') {
        return { responseCode: 'DOCTOR_EDUCATION_FORBIDDEN', message: 'Only doctors can access Education.' };
      }

      const prev = getEducationState(appStore);
      const selectedTopic = String(request.data?.topic ?? prev.selectedTopic ?? '').trim();
      const draftText = String(request.data?.draftText ?? prev.draftText ?? '').trim();
      const hasTopic = selectedTopic.length > 0;
      const draftOk = draftText.trim().length >= 3;
      if (!hasTopic && !draftOk) return ok();

      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        loading: true,
        error: '',
        selectedTopic,
        draftText,
        focusSummary: ''
      });

      try {
        const prompt = buildEducationPrompt({
          department: String(auth.department ?? ''),
          topic: selectedTopic,
          freeText: draftText,
          cardCount: request.data?.cardCount as number | undefined,
          selectedBook: String(prev.selectedBook ?? '').trim()
        });
        const retrievalSeed = buildEducationRetrievalSeed(selectedTopic, draftText);
        const response = await apiClient.post(
          URLRegistry.paths.hospitalAiChat,
          hospitalAiChatPayload(prompt, [], String(prev.selectedBook ?? ''), retrievalSeed)
        );
        const data = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
        const reply = String(data.reply ?? data.message ?? '').trim();
        const { summary: focusSummary, cards: flashcards } = parseSummaryAndFlashcards(reply);
        const latest = getEducationState(appStore);
        appStore.setData('hospital', 'DoctorEducationUiState', {
          ...latest,
          loading: false,
          error: flashcards.length > 0 ? '' : 'Could not generate flashcards for this topic.',
          focusSummary,
          flashcards,
          aiRawReply: reply,
          detailByCardId: {}
        });
        return ok({ cards: flashcards.length });
      } catch (err: unknown) {
        const exactMessage = extractApiErrorMessage(err, 'Education assistant is temporarily unavailable.');
        const latest = getEducationState(appStore);
        appStore.setData('hospital', 'DoctorEducationUiState', {
          ...latest,
          loading: false,
          error: exactMessage
        });
        toastStore.show(exactMessage, 'error');
        return { responseCode: 'DOCTOR_EDUCATION_GENERATION_FAILED', message: exactMessage };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'generate-doctor-education-card-detail',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(auth.role ?? '').trim().toUpperCase();
      if (role !== 'DOCTOR') {
        return { responseCode: 'DOCTOR_EDUCATION_FORBIDDEN', message: 'Only doctors can access Education.' };
      }

      const cardId = String(request.data?.cardId ?? '').trim();
      const front = String(request.data?.front ?? '').trim();
      const back = String(request.data?.back ?? '').trim();
      const requestedLevel = String(request.data?.level ?? 'MBBS').trim().toUpperCase();
      const levelGroup = normalizeLevelGroup(requestedLevel);
      const detailKey = `${cardId}::${levelGroup}`;
      if (!cardId || !front || !back) {
        return { responseCode: 'DOCTOR_EDUCATION_DETAIL_FAILED', message: 'Missing card details.' };
      }

      const prev = getEducationState(appStore);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        detailLoadingCardId: cardId,
        error: ''
      });

      try {
        const prompt = buildCardDetailPrompt({
          level: requestedLevel,
          department: String(auth.department ?? ''),
          topic: String(prev.selectedTopic ?? ''),
          front,
          back
        });
        const retrievalSeed = buildCardDetailRetrievalSeed(String(prev.selectedTopic ?? ''), front, back);
        const response = await apiClient.post(
          URLRegistry.paths.hospitalAiChat,
          hospitalAiChatPayload(prompt, [], String(prev.selectedBook ?? ''), retrievalSeed)
        );
        const data = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
        const detail = String(data.reply ?? data.message ?? '').trim();
        const latest = getEducationState(appStore);
        const byCard = (latest.detailByCardId ?? {}) as Record<string, string>;
        appStore.setData('hospital', 'DoctorEducationUiState', {
          ...latest,
          detailLoadingCardId: '',
          detailByCardId: {
            ...byCard,
            [detailKey]: detail || 'No additional detail found for this card.'
          }
        });
        return ok();
      } catch (err: unknown) {
        const exactMessage = extractApiErrorMessage(err, 'Could not fetch detailed card information right now.');
        const latest = getEducationState(appStore);
        appStore.setData('hospital', 'DoctorEducationUiState', {
          ...latest,
          detailLoadingCardId: '',
          error: exactMessage
        });
        toastStore.show(exactMessage, 'error');
        return { responseCode: 'DOCTOR_EDUCATION_DETAIL_FAILED', message: exactMessage };
      }
    }
  }
];

