import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';

type Flashcard = { id: string; front: string; back: string };
type EducationState = {
  loading?: boolean;
  error?: string;
  draftText?: string;
  selectedTopic?: string;
  topics?: string[];
  flashcards?: Flashcard[];
  aiRawReply?: string;
  detailByCardId?: Record<string, string>;
  detailLoadingCardId?: string;
};

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

function buildEducationPrompt(params: { department: string; topic: string; freeText: string; cardCount?: number }): string {
  const cardCount = Math.max(4, Math.min(12, Number(params.cardCount ?? 8)));
  const department = params.department.trim() || 'General Medicine';
  const topic = params.topic.trim() || 'Clinical education';
  const focus = params.freeText.trim() || topic;
  return [
    `You are creating flashcards for a DOCTOR education module.`,
    `Department: ${department}`,
    `Primary topic: ${topic}`,
    `Extra focus from doctor: ${focus}`,
    '',
    `Generate exactly ${cardCount} flashcards for clinical learning.`,
    'Each flashcard should be concise, practical, and medically accurate.',
    'Keep each Front under 16 words and each Back under 80 words.',
    'Do not include disclaimers, markdown tables, or extra commentary.',
    '',
    'Return strictly in this plain-text format only:',
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
    'Return a concise but detailed expansion with:',
    '1) Clinical significance',
    '2) Pathophysiology or mechanism',
    '3) Workup/assessment points',
    '4) Management pearls',
    '5) Pitfalls/red flags',
    '',
    ...depthDirective,
    '',
    'Keep it practical and evidence-aligned. No markdown table.'
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

function extractApiErrorMessage(err: unknown, fallback: string): string {
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
      const topics = topicsForDepartment(department);
      const prev = getEducationState(appStore);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        loading: false,
        error: '',
        topics,
        selectedTopic: prev.selectedTopic && topics.includes(prev.selectedTopic) ? prev.selectedTopic : topics[0] ?? '',
        draftText: String(prev.draftText ?? '').trim(),
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
    serviceId: 'set-doctor-education-draft',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const prev = getEducationState(appStore);
      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        draftText: String(request.data?.value ?? ''),
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
      const focus = draftText || selectedTopic;
      if (focus.length < 3) return ok();

      appStore.setData('hospital', 'DoctorEducationUiState', {
        ...prev,
        loading: true,
        error: '',
        selectedTopic,
        draftText
      });

      try {
        const prompt = buildEducationPrompt({
          department: String(auth.department ?? ''),
          topic: selectedTopic,
          freeText: draftText,
          cardCount: request.data?.cardCount as number | undefined
        });
        const response = await apiClient.post(URLRegistry.paths.hospitalAiChat, {
          message: prompt,
          history: []
        });
        const data = (response.data?.Data ?? response.data?.data ?? {}) as Record<string, unknown>;
        const reply = String(data.reply ?? data.message ?? '').trim();
        const flashcards = parseFlashcards(reply);
        const latest = getEducationState(appStore);
        appStore.setData('hospital', 'DoctorEducationUiState', {
          ...latest,
          loading: false,
          error: flashcards.length > 0 ? '' : 'Could not generate flashcards for this topic.',
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
        const response = await apiClient.post(URLRegistry.paths.hospitalAiChat, {
          message: prompt,
          history: []
        });
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

