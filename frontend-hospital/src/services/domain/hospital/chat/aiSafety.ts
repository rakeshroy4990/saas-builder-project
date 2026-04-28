export const AI_DISCLAIMER_LINE =
  '💡 General guidance only. If symptoms worsen or persist, consult a qualified healthcare provider.';
export const AI_NON_DOCTOR_LINE = 'I am not a doctor.';
export const AI_EMERGENCY_REPLY =
  'This may be a possible overdose or poisoning emergency. Call your local emergency number immediately, or contact your poison control center right away for urgent guidance.\n\n' +
  'If this happened recently, do not take more medicine, and keep the medicine strip/bottle nearby to share exact dose and time taken.\n\n' +
  `${AI_NON_DOCTOR_LINE}\n\n${AI_DISCLAIMER_LINE}`;

function normalizeClinicalText(raw: string): string {
  const normalized = raw
    // Remove non-printable control characters that leak from OCR/context joins.
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    // Remove soft hyphen and normalize uncommon spacing.
    .replace(/\u00ad/g, '')
    .replace(/\u2009/g, ' ')
    .replace(/\u202f/g, ' ')
    // Ensure bullet points render line-by-line in chat.
    .replace(/\s*•\s*/g, '\n• ')
    // Put likely section starts on new lines.
    .replace(/\s+(Adolescents and Adults:|Children weighing|Children age|Alternative:|Preferred:)/g, '\n$1')
    // Avoid giant run-on lines after punctuation.
    .replace(/([.;])\s+(?=[A-Z<≥≤])/g, '$1\n')
    // Keep spacing readable while preserving intentional new lines.
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
    // Fix OCR/format artifacts where bullet symbol appears alone on one line.
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
    // Keep normal lines untouched for readability.
    if (line.length <= 220) {
      out.push(line);
      continue;
    }
    // For very long lines, chunk by punctuation/clauses.
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
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizedAiReply(raw: unknown): string {
  let text = normalizeClinicalText(String(raw ?? '').trim());
  if (!text) text = AI_NON_DOCTOR_LINE;
  if (!text.toLowerCase().includes('not a doctor')) {
    text = `${text}\n\n${AI_NON_DOCTOR_LINE}`;
  }
  if (!text.includes(AI_DISCLAIMER_LINE)) {
    text = `${text}\n\n${AI_DISCLAIMER_LINE}`;
  }
  return text.trim();
}

export function requiresEscalation(input: string): boolean {
  const text = String(input ?? '').toLowerCase();
  const criticalKeywords = [
    'chest pain',
    'difficulty breathing',
    'shortness of breath',
    'stroke',
    'slurred speech',
    'face drooping',
    'high fever',
    '39.4',
    '103',
    'uncontrolled bleeding',
    'severe abdominal pain',
    'suicidal',
    'self-harm',
    'self harm',
    'overdose',
    'toxic dose',
    'toxicity',
    'poison',
    'poisoning',
    'drug overdose',
    'medication overdose',
    'pill overdose',
    'accidental ingestion',
    'took too much',
    'too many tablets',
    'azithromycin overdose',
    'azithromycin toxicity'
  ];
  return criticalKeywords.some((term) => text.includes(term));
}
