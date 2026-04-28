export const AI_DISCLAIMER_LINE =
  '💡 General guidance only. If symptoms worsen or persist, consult a qualified healthcare provider.';
export const AI_NON_DOCTOR_LINE = 'I am not a doctor.';
export const AI_EMERGENCY_REPLY =
  'This may be a possible overdose or poisoning emergency. Call your local emergency number immediately, or contact your poison control center right away for urgent guidance.\n\n' +
  'If this happened recently, do not take more medicine, and keep the medicine strip/bottle nearby to share exact dose and time taken.\n\n' +
  `${AI_NON_DOCTOR_LINE}\n\n${AI_DISCLAIMER_LINE}`;

export function normalizedAiReply(raw: unknown): string {
  let text = String(raw ?? '').trim();
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
