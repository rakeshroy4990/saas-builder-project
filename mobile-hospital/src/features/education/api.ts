import {
  pickString,
  SERVER_PATHS,
  unwrapEnvelope
} from '@saas-builder/hospital-api-client';

import { postHospitalAiChatNdjson } from '@/api/hospitalAiChatStream';
import { apiClient } from '@/api/client';
import { UPLOAD_API_TIMEOUT_MS } from '@/api/timeouts';
import { buildEducationChatPayload } from '@/features/education/educationChatPayload';
import {
  parseEducationChatComplete,
  type EducationChatResult
} from '@/features/education/parseEducationChatComplete';

export type { EducationChatResult } from '@/features/education/parseEducationChatComplete';

export { buildEducationChatPayload } from '@/features/education/educationChatPayload';

export async function fetchEducationBooks(): Promise<string[]> {
  const response = await apiClient.get(SERVER_PATHS.hospitalEducationBooks);
  const data = unwrapEnvelope<unknown>(response.data);
  if (Array.isArray(data)) {
    return data.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as Record<string, unknown>;
    const list = row.books ?? row.Books ?? row.items ?? row.Items;
    if (Array.isArray(list)) {
      return list.map((item) => String(item ?? '').trim()).filter(Boolean);
    }
  }
  return [];
}

export async function fetchEducationKeyTopics(bookName: string, limit = 12): Promise<string[]> {
  const response = await apiClient.get(SERVER_PATHS.hospitalEducationKeyTopics, {
    params: { BookName: bookName, Limit: limit }
  });
  const data = unwrapEnvelope<unknown>(response.data);
  if (Array.isArray(data)) {
    return data.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as Record<string, unknown>;
    const list = row.topics ?? row.Topics ?? row.items ?? row.Items;
    if (Array.isArray(list)) {
      return list.map((item) => String(item ?? '').trim()).filter(Boolean);
    }
  }
  return [];
}

export type EducationChatTurn = { role: 'user' | 'assistant'; content: string };

export type EducationStreamHandlers = {
  onStatus?: (phase: string) => void;
  onDelta?: (textSoFar: string) => void;
};

export async function askEducationQuestionStreaming(
  question: string,
  bookNames: string[],
  history: EducationChatTurn[],
  conversationId: string,
  handlers: EducationStreamHandlers = {},
  retrievalQuestion?: string
): Promise<EducationChatResult> {
  const payload = buildEducationChatPayload(
    question,
    bookNames,
    history,
    conversationId,
    retrievalQuestion
  );

  let textSoFar = '';
  let completePayload: Record<string, unknown> | null = null;
  const streamed = await postHospitalAiChatNdjson(payload, {
    onStatus: handlers.onStatus,
    onDelta: (chunk) => {
      textSoFar += chunk;
      handlers.onDelta?.(textSoFar);
    },
    onComplete: (data) => {
      completePayload = data;
    }
  });
  return parseEducationChatComplete(completePayload, streamed || textSoFar);
}

/** @deprecated Use {@link askEducationQuestionStreaming} for progressive UI. */
export async function askEducationQuestion(
  question: string,
  bookNames: string[],
  history: EducationChatTurn[],
  conversationId: string
): Promise<EducationChatResult> {
  return askEducationQuestionStreaming(question, bookNames, history, conversationId);
}

export type PrescriptionSimilarityHit = {
  externalId: string;
  matchPercent: number;
  patientName: string;
  searchText: string;
  diagnosis: string;
  createdAt: string;
};

function mapSimilarityHit(item: Record<string, unknown>): PrescriptionSimilarityHit {
  const details = (item.details ?? item.Details ?? {}) as Record<string, unknown>;
  return {
    externalId: pickString(item, ['externalId', 'external_id']) ?? '',
    matchPercent: Number(item.matchPercent ?? item.match_percent ?? 0) || 0,
    patientName: pickString(item, ['patientName', 'patient_name']) ?? '',
    searchText: pickString(item, ['searchText', 'search_text']) ?? '',
    diagnosis: pickString(details, ['diagnosis', 'Diagnosis']) ?? '',
    createdAt: pickString(item, ['createdAt', 'created_at']) ?? ''
  };
}

export async function searchSimilarPrescriptions(query: string, limit = 10): Promise<PrescriptionSimilarityHit[]> {
  const formData = new FormData();
  formData.append('query', query.trim());
  formData.append('limit', String(limit));

  const response = await apiClient.post(SERVER_PATHS.patientPrescriptionsSimilaritySearch, formData, {
    timeout: UPLOAD_API_TIMEOUT_MS,
    headers: { Accept: 'application/json' }
  });
  const data = unwrapEnvelope<unknown>(response.data);
  const rows = Array.isArray(data) ? data : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)))
    .map(mapSimilarityHit)
    .filter((hit) => hit.externalId || hit.searchText || hit.diagnosis);
}
