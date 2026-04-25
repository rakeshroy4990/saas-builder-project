export const AI_DISCLAIMER_LINE =
  '💡 This is general guidance only. If symptoms worsen or persist, please consult a qualified healthcare provider.';
export const AI_NON_DOCTOR_LINE = 'I am not a doctor and this is not medical advice.';
export const AI_EMERGENCY_REPLY =
  'Your symptoms may need urgent medical attention. Please contact emergency services or visit the nearest emergency department immediately.\n\n' +
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
    'self harm'
  ];
  return criticalKeywords.some((term) => text.includes(term));
}
