import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';
import { extractDiagnosisMedicationsFromPlainText } from './extractPrescriptionDiagnosisMedications';

export type EducationPrescriptionTranscribeResult = {
  diagnosis: string;
  medications: string;
  medicines: string[];
  dosage: string[];
  advice: string[];
  notes: string;
  /** Legacy API `text` / OCR blob; used for the question draft when structured fields are missing. */
  rawText?: string;
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

  if (legacyText) {
    const extracted = extractDiagnosisMedicationsFromPlainText(legacyText);
    if (!diagnosis || diagnosis === 'Not stated') {
      diagnosis = extracted.diagnosis;
    }
    if (!medications || medications === 'Not stated') {
      medications = extracted.medications;
    }
  }

  if (!diagnosis) diagnosis = 'Not stated';
  if (!medications) medications = 'Not stated';

  const rawText = legacyText || undefined;

  return {
    diagnosis,
    medications,
    medicines: parseStringList(inner, 'medicines', 'Medicines', medications),
    dosage: parseStringList(inner, 'dosage', 'Dosage', ''),
    advice: parseStringList(inner, 'advice', 'Advice', ''),
    notes: String(inner?.notes ?? inner?.Notes ?? '').trim(),
    rawText
  };
}

function parseStringList(
  inner: Record<string, unknown> | undefined,
  ...keysAndFallback: (string | undefined)[]
): string[] {
  if (!inner) return [];
  for (let i = 0; i < keysAndFallback.length - 1; i++) {
    const key = keysAndFallback[i];
    if (!key) continue;
    const raw = inner[key];
    if (Array.isArray(raw)) {
      const items = raw.map((entry) => String(entry ?? '').trim()).filter(Boolean);
      if (items.length) return items;
    }
  }
  const fallback = String(keysAndFallback[keysAndFallback.length - 1] ?? '').trim();
  if (!fallback || fallback.toLowerCase() === 'not stated') return [];
  return fallback
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Clinical text for vector similarity search after a file has been transcribed. */
export function buildSimilarityQueryFromTranscribe(result: EducationPrescriptionTranscribeResult): string {
  if (isPrescriptionFullyNotStated(result) && result.rawText?.trim()) {
    return result.rawText.trim();
  }
  const parts: string[] = [];
  const d = result.diagnosis.trim();
  if (d && d.toLowerCase() !== 'not stated') parts.push(d);
  if (result.medicines.length) {
    parts.push(result.medicines.join(', '));
  } else {
    const m = result.medications.trim();
    if (m && m.toLowerCase() !== 'not stated') {
      parts.push(m.replace(/\n+/g, ', '));
    }
  }
  return parts.join('. ').trim();
}

/** True when both structured fields failed — do not auto-call education chat. */
export function isPrescriptionFullyNotStated(result: EducationPrescriptionTranscribeResult): boolean {
  return (
    result.diagnosis.trim().toLowerCase() === 'not stated' &&
    result.medications.trim().toLowerCase() === 'not stated'
  );
}

/** Text to put in the composer: structured lines, or full OCR when both fields failed. */
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

/**
 * POST multipart prescription file; returns structured diagnosis + medications for education chat.
 */
export async function postEducationPrescriptionTranscribe(file: File): Promise<EducationPrescriptionTranscribeResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post<unknown>(SERVER_PATHS.hospitalEducationPrescriptionTranscribe, formData);
  return readEnvelope(res.data);
}
