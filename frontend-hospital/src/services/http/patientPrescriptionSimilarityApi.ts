import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';

export type {
  PatientPrescriptionSimilarityDetails,
  PatientPrescriptionSimilarityHit,
  PatientPrescriptionSimilaritySectionScore
} from './patientPrescriptionSimilarityMapping';

export {
  mapPatientPrescriptionSimilarityHit,
  readPatientPrescriptionSimilarityEnvelope
} from './patientPrescriptionSimilarityMapping';

import {
  readPatientPrescriptionSimilarityEnvelope,
  type PatientPrescriptionSimilarityHit
} from './patientPrescriptionSimilarityMapping';

/** Similarity runs embeddings + vector search; allow longer than default axios 15s. */
const SIMILARITY_TIMEOUT_MS = 180_000;

function buildFormData(opts: {
  query?: string;
  file?: File;
  limit?: number;
}): FormData {
  const formData = new FormData();
  const query = String(opts.query ?? '').trim();
  if (query) formData.append('query', query);
  if (opts.file) formData.append('file', opts.file);
  if (opts.limit != null && opts.limit > 0) {
    formData.append('limit', String(opts.limit));
  }
  return formData;
}

/**
 * POST multipart to Spring `/api/v1/patient-prescriptions/similarity-search` (JSON envelope).
 * Uses the same axios transport as prescription transcribe — reliably hits port 8080.
 */
export async function postPatientPrescriptionSimilaritySearch(opts: {
  query?: string;
  file?: File;
  limit?: number;
  onStatus?: (phase: string) => void;
  onHit?: (hit: PatientPrescriptionSimilarityHit) => void;
  signal?: AbortSignal;
}): Promise<PatientPrescriptionSimilarityHit[]> {
  opts.onStatus?.('embedding');
  const formData = buildFormData(opts);
  opts.onStatus?.('searching');

  const res = await apiClient.post<unknown>(SERVER_PATHS.patientPrescriptionsSimilaritySearch, formData, {
    timeout: SIMILARITY_TIMEOUT_MS,
    signal: opts.signal,
    headers: { Accept: 'application/json' }
  });

  const hits = readPatientPrescriptionSimilarityEnvelope(res.data);
  opts.onStatus?.('section_scores');
  for (const hit of hits) {
    opts.onHit?.(hit);
  }
  return hits;
}
