/**
 * Maps natural-language chat input to internal hospital features.
 * Used by Smart AI chat before falling through to the RAG assistant.
 */

export type ChatFeatureIntent = 'book_appointment' | 'check_availability' | 'video_call';

export type GuidedFlowStep =
  | 'department'
  | 'doctor'
  | 'age'
  | 'date'
  | 'time_slot'
  | 'show_availability'
  | 'complete';

export type ChatFeatureIntentDefinition = {
  id: ChatFeatureIntent;
  /** Higher priority wins when multiple intents match (video_call > check_availability > book_appointment). */
  priority: number;
  triggers: RegExp[];
  /** Minimum questions required before the feature action runs. */
  steps: GuidedFlowStep[];
};

export const CHAT_FEATURE_INTENTS: ChatFeatureIntentDefinition[] = [
  {
    id: 'video_call',
    priority: 30,
    triggers: [
      /\bvideo\s*call\b/i,
      /\btele\s*consult/i,
      /\bvirtual\s+(visit|consult)/i,
      /\bcall\s+(a\s+)?doctor\b/i,
      /\bconsult\s+(a\s+)?doctor\s+(online|on\s*line|by\s*video)\b/i
    ],
    steps: ['department', 'doctor', 'show_availability', 'complete']
  },
  {
    id: 'check_availability',
    priority: 20,
    triggers: [
      /\bcheck\s+(the\s+)?availab/i,
      /\bdoctor\s+availab/i,
      /\bwhen\s+is\b.*\bavailab/i,
      /\b(is|are)\b.*\bdoctor\b.*\bavailab/i,
      /\bavailable\s+slots?\b/i,
      /\bfree\s+slots?\b/i,
      /\bdoctor\s+schedule\b/i,
      /\bwho\s+is\s+available\b/i
    ],
    steps: ['department', 'doctor', 'show_availability', 'complete']
  },
  {
    id: 'book_appointment',
    priority: 10,
    triggers: [
      /\bset\s+(an?\s+)?appointment\b/i,
      /\bbook\s+(an?\s+)?appointment\b/i,
      /\bschedule\s+(an?\s+)?(visit|appointment)\b/i,
      /\bmake\s+(an?\s+)?appointment\b/i,
      /\bwant\s+to\s+(set|book|schedule)\s+(an?\s+)?appointment\b/i,
      /\bneed\s+(an?\s+)?appointment\b/i,
      /\bappointment\s+booking\b/i
    ],
    steps: ['department', 'doctor', 'age', 'date', 'time_slot', 'complete']
  }
];

const CANCEL_PATTERNS: RegExp[] = [
  /\b(cancel|never\s*mind|nevermind|stop|quit|abort)\b/i,
  /\bforget\s+it\b/i
];

export function isGuidedFlowCancelMessage(message: string): boolean {
  const text = String(message ?? '').trim();
  if (!text) return false;
  return CANCEL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Returns the highest-priority matching intent, or null when no feature intent is detected.
 */
export function detectChatFeatureIntent(message: string): ChatFeatureIntent | null {
  const text = String(message ?? '').trim();
  if (!text || isGuidedFlowCancelMessage(text)) return null;

  let best: ChatFeatureIntentDefinition | null = null;
  for (const intent of CHAT_FEATURE_INTENTS) {
    if (!intent.triggers.some((pattern) => pattern.test(text))) continue;
    if (!best || intent.priority > best.priority) {
      best = intent;
    }
  }
  return best?.id ?? null;
}

export function getIntentDefinition(intent: ChatFeatureIntent): ChatFeatureIntentDefinition {
  const found = CHAT_FEATURE_INTENTS.find((row) => row.id === intent);
  if (!found) {
    throw new Error(`Unknown chat feature intent: ${intent}`);
  }
  return found;
}

export function firstStepForIntent(intent: ChatFeatureIntent): GuidedFlowStep {
  return getIntentDefinition(intent).steps[0];
}

export function nextStepForIntent(intent: ChatFeatureIntent, current: GuidedFlowStep): GuidedFlowStep | null {
  const steps = getIntentDefinition(intent).steps;
  const idx = steps.indexOf(current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
}
