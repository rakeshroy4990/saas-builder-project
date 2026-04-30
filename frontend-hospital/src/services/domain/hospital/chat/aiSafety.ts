export const AI_DISCLAIMER_LINE =
  '💡 General guidance only. If symptoms worsen or persist, consult a qualified healthcare provider.';
export const AI_NON_DOCTOR_LINE = 'I am not a doctor.';
export const AI_EMERGENCY_REPLY =
  'This may be a possible overdose or poisoning emergency. Call your local emergency number immediately, or contact your poison control center right away for urgent guidance.\n\n' +
  'If this happened recently, do not take more medicine, and keep the medicine strip/bottle nearby to share exact dose and time taken.\n\n' +
  `${AI_NON_DOCTOR_LINE}\n\n${AI_DISCLAIMER_LINE}`;

const GI_KEYWORDS = [
  'stomach', 'abdominal', 'abdomen', 'belly', 'gastric', 'gas', 'acidity', 'indigestion',
  'nausea', 'vomit', 'vomiting', 'diarrhea', 'loose motion', 'bloating', 'food', 'after eating'
];

const RESPIRATORY_FALLBACK_PHRASES = [
  'common viral upper respiratory infections can cause these symptoms',
  'seasonal flu or throat/chest irritation can also present similarly'
];

const ESCALATION_PATTERNS: RegExp[] = [
  /chest\s*[-–]?\s*pain/i,
  /can'?t\s+breathe|trouble\s+breath|difficulty\s+breath|short\s*ness\s+of\s+breath/i,
  /slurred?\s+speech/i,
  /face\s+droop/i,
  /stroke/i,
  /took\s+too\s+many\s+(pills?|tablets?|capsules?|medicines?|doses?)/i,
  /too\s+many\s+(pills?|tablets?|capsules?)/i,
  /swallowed?\s+(too\s+much|poison|bleach|acid|chemical)/i,
  /\boverdos(e|ed|ing)\b/i,
  /\btoxic\s*(dose|level|amount)?\b/i,
  /\bpoisoning?\b/i,
  /accidental\s+ingestion/i,
  /uncontrolled\s+bleeding/i,
  /severe\s+abdominal\s+pain/i,
  /suicidal|self[\s-]harm/i,
  /high\s+fever|39\.4|103\s*[°f]/i,
  /ingested?\s+(too\s+much|wrong|accidental)/i,
  // Named drug overdose patterns (extensible)
  /\b(azithromycin|paracetamol|acetaminophen|ibuprofen|aspirin|metformin)\s+(overdos|toxic|too\s+much)/i,
];

function isRespiratoryFallback(text: string): boolean {
  const normalized = String(text ?? '').toLowerCase();
  return RESPIRATORY_FALLBACK_PHRASES.some((phrase) => normalized.includes(phrase));
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function isLikelyGIPrompt(prompt: string): boolean {
  const normalized = String(prompt ?? '').toLowerCase();
  const keywordHits = GI_KEYWORDS.filter((kw) => normalized.includes(kw)).length;
  return keywordHits >= 2;
}

function conversationHasGIContext(history: ConversationMessage[]): boolean {
  if (!history || history.length === 0) return false;
  return history
    .slice(-6)
    .filter((msg) => msg.role === 'user')
    .some((msg) => isLikelyGIPrompt(String(msg.content ?? '')));
}

function normalizeClinicalText(raw: string): string {
  const normalized = raw
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    .replace(/\u00ad/g, '')
    .replace(/\u2009/g, ' ')
    .replace(/\u202f/g, ' ')
    .replace(/\s*•\s*/g, '\n• ')
    .replace(/(^|\n)\s*(\d+)\.\s*\n+\s*([^\n])/g, '$1$2. $3')
    .replace(/(^|\n)\s*(\d+)\)\s*\n+\s*([^\n])/g, '$1$2. $3')
    .replace(/\s+(Adolescents and Adults:|Children weighing|Children age|Alternative:|Preferred:)/g, '\n$1')
    .replace(/([.;])\s+(?=[A-Z<≥≤])/g, '$1\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return splitLongClinicalLines(normalized);
}

function splitLongClinicalLines(text: string): string {
  const lines = text.split('\n');
  const mergedLines: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const current = rawLine.trim();
    if (!current) {
      mergedLines.push('');
      continue;
    }
    if (current === '•') {
      const nextIndex = i + 1;
      const nextRaw = nextIndex < lines.length ? String(lines[nextIndex] ?? '').trim() : '';
      if (nextRaw) {
        mergedLines.push(`• ${nextRaw}`);
        i += 1;
        continue;
      }
    }
    mergedLines.push(rawLine);
  }

  const out: string[] = [];
  for (const rawLine of mergedLines) {
    const line = rawLine.trim();
    if (!line) {
      out.push('');
      continue;
    }
    if (line.length <= 220) {
      out.push(line);
      continue;
    }
    const bulletPrefix = line.startsWith('• ') ? '• ' : '';
    const content = bulletPrefix ? line.slice(2).trim() : line;
    const chunks = content
      .split(/(?<=[.;])\s+|\s+(?=Preferred:|Alternative:|Children weighing|Children age|Adolescents and Adults:)/g)
      .map((part) => part.trim())
      .filter(Boolean);
    if (chunks.length <= 1) {
      out.push(line);
      continue;
    }
    chunks.forEach((chunk, idx) => {
      if (idx === 0) {
        out.push(`${bulletPrefix}${chunk}`.trim());
      } else if (bulletPrefix) {
        out.push(`  - ${chunk}`);
      } else {
        out.push(chunk);
      }
    });
  }
  const compact = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return convertLongParagraphsToBullets(compact);
}

function convertLongParagraphsToBullets(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      out.push('');
      continue;
    }
    if (isSectionHeading(line) || isBulletLike(line)) {
      out.push(line);
      continue;
    }
    if (line.length < 110) {
      out.push(line);
      continue;
    }

    const sentenceParts = splitIntoReadableSentences(line);
    if (sentenceParts.length <= 1) {
      out.push(line);
      continue;
    }
    sentenceParts.forEach((part) => out.push(`- ${part}`));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitIntoReadableSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      if (part.length <= 140) return [part];
      return part
        .split(/\s+(?=and |but |if |which |who |that )/i)
        .map((clause) => clause.trim())
        .filter((clause) => clause.length > 0);
    });
}

function isSectionHeading(line: string): boolean {
  return /^\d+\.\s+\S+/.test(line);
}

function isBulletLike(line: string): boolean {
  return /^[-•*]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
}

function toGastroStructuredReply(): string {
  return [
    '1. Possible causes',
    '- Food intolerance or sensitivity to ingredients/oil/spices can trigger pain after eating.',
    '- Acidity, gastritis, or indigestion can also cause stomach discomfort after meals.',
    '',
    '2. What you can do',
    '- Drink water, eat light meals, and avoid oily/spicy foods for 24-48 hours.',
    '- Monitor for associated symptoms like nausea, bloating, vomiting, loose stools, or fever.',
    '- If symptoms repeat after specific foods, track triggers and discuss them with your doctor.',
    '',
    '3. When to see a doctor',
    '- See a doctor if pain keeps recurring after meals, lasts more than 1-2 days, or becomes more severe.',
    '- Seek urgent care for severe abdominal pain, repeated vomiting, blood in stool/vomit, high fever, or dehydration signs.'
  ].join('\n');
}

export function normalizedAiReply(
  raw: unknown,
  userPrompt?: string,
  conversationHistory?: ConversationMessage[]
): string {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return `Something went wrong fetching a response. Please try again.\n\n${AI_DISCLAIMER_LINE}`;
  }

  let text = normalizeClinicalText(String(raw).trim());
  const prompt = String(userPrompt ?? '').trim();

  const giPrompt =
    isLikelyGIPrompt(prompt) ||
    conversationHasGIContext(conversationHistory ?? []);

  // Keep this as a last-resort safety net only.
  if (giPrompt && isRespiratoryFallback(text)) {
    text = toGastroStructuredReply();
  }

  if (!text) text = AI_NON_DOCTOR_LINE;

  const lowerText = text.toLowerCase();

  if (!lowerText.includes('not a doctor')) {
    text = `${text}\n\n${AI_NON_DOCTOR_LINE}`;
  }

  if (!text.toLowerCase().includes(AI_DISCLAIMER_LINE.toLowerCase())) {
    text = `${text}\n\n${AI_DISCLAIMER_LINE}`;
  }

  return text.trim();
}

export function requiresEscalation(input: string): boolean {
  const text = String(input ?? '').toLowerCase();
  return ESCALATION_PATTERNS.some((pattern) => pattern.test(text));
}