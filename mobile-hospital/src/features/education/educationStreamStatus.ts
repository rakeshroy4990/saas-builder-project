import type { TFunction } from 'i18next';

/** NDJSON status phases from pdf-rag / Spring before the first answer token. */
export function educationStreamStatusLabel(phase: string, t: TFunction): string {
  const p = phase.trim().toLowerCase();
  if (p === 'retrieving' || p === 'accepted') {
    return t('education.streamSearchingSources');
  }
  if (p === 'generating') {
    return t('education.streamGeneratingAnswer');
  }
  return t('education.streamLoadingAnswer');
}
