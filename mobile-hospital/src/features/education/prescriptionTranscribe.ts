import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import { normalizeUploadMimeType } from '@/api/multipart';
import { postMultipartLocalFile } from '@/api/postMultipart';

export type EducationPrescriptionTranscribeResult = {
  diagnosis: string;
  medications: string;
  rawText?: string;
};

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
};

function readEnvelope(data: unknown): EducationPrescriptionTranscribeResult {
  const root = data as Record<string, unknown>;
  const ok = Boolean(root?.success ?? root?.Success);
  if (!ok) {
    const msg = String(root?.message ?? root?.Message ?? 'Transcription failed').trim();
    throw new Error(msg || 'Transcription failed');
  }
  const inner = (root?.data ?? root?.Data) as Record<string, unknown> | undefined;
  let diagnosis = String(inner?.diagnosis ?? inner?.Diagnosis ?? '').trim();
  let medications = String(inner?.medications ?? inner?.Medications ?? '').trim();
  const legacyText = String(inner?.text ?? inner?.Text ?? '').trim();

  if (!diagnosis) diagnosis = 'Not stated';
  if (!medications) medications = 'Not stated';

  return {
    diagnosis,
    medications,
    rawText: legacyText || undefined
  };
}

export function isPrescriptionFullyNotStated(result: EducationPrescriptionTranscribeResult): boolean {
  return (
    result.diagnosis.trim().toLowerCase() === 'not stated' &&
    result.medications.trim().toLowerCase() === 'not stated'
  );
}

export function buildPrescriptionQuestionDraft(result: EducationPrescriptionTranscribeResult): string {
  const d = result.diagnosis.trim().toLowerCase();
  const m = result.medications.trim().toLowerCase();
  if (d === 'not stated' && m === 'not stated' && result.rawText?.trim()) {
    return result.rawText.trim();
  }
  return formatPrescriptionForChat(result);
}

export function formatPrescriptionForChat(result: EducationPrescriptionTranscribeResult): string {
  const d = result.diagnosis.trim() || 'Not stated';
  const m = result.medications.trim() || 'Not stated';
  return `Diagnosis:\n${d}\n\nMedications:\n${m}`;
}

export function buildSimilarityQueryFromTranscribe(result: EducationPrescriptionTranscribeResult): string {
  if (isPrescriptionFullyNotStated(result) && result.rawText?.trim()) {
    return result.rawText.trim();
  }
  const parts: string[] = [];
  const d = result.diagnosis.trim();
  if (d && d.toLowerCase() !== 'not stated') parts.push(d);
  const m = result.medications.trim();
  if (m && m.toLowerCase() !== 'not stated') parts.push(m.replace(/\n+/g, ', '));
  return parts.join('. ').trim();
}

export async function postEducationPrescriptionTranscribe(file: PickedFile): Promise<EducationPrescriptionTranscribeResult> {
  const name = file.name.trim() || `prescription-${Date.now()}.jpg`;
  const type = normalizeUploadMimeType(name, file.mimeType);
  const data = await postMultipartLocalFile(
    SERVER_PATHS.hospitalEducationPrescriptionTranscribe,
    file.uri,
    name,
    type
  );
  return readEnvelope(data);
}
