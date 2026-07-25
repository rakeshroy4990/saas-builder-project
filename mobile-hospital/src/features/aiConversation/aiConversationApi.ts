import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

import { isLikelyOffline, toUserFacingApiError } from '@/api/apiErrors';
import { apiClient } from '@/api/client';
import { postMultipartLocalFile } from '@/api/postMultipart';
import { UPLOAD_API_TIMEOUT_MS } from '@/api/timeouts';
import { useNetworkStore } from '@/network/networkStore';

export type AiConversationTurn = {
  Speaker: string;
  Text: string;
};

export type AiConversationMedicine = {
  Name: string;
  Strength: string;
  Dose: string;
  Frequency: string;
  Route: string;
  DurationDays: string;
  Instructions: string;
  ScheduleCategory: string;
};

export type AiConversationPrescription = {
  Complaint: string;
  History: string;
  Diagnosis: string;
  Medicines: AiConversationMedicine[];
  Investigations: string[];
  Advice: string;
  FollowUpAdvice: string;
  Allergies: string;
  ClinicalNotes: string;
};

export type AiConversationSession = {
  sessionId: string;
  appointmentId: string;
  status: string;
  durationSeconds: number | null;
  chunkCount: number;
  languageDetected: string;
  languageHint: string;
  audioUrl: string;
  transcriptText: string;
  transcript: AiConversationTurn[];
  speakersSwapped: boolean;
  structuredJson: Record<string, unknown>;
  summary: Record<string, unknown>;
  soap: Record<string, unknown>;
  prescription: AiConversationPrescription;
  committed: boolean;
  message: string;
};

export type AppointmentOption = { id: string; label: string; value: string };

const PIPELINE_TIMEOUT_MS = UPLOAD_API_TIMEOUT_MS;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function parseTurns(raw: unknown): AiConversationTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = asRecord(row);
    return {
      Speaker: pickString(r, ['Speaker', 'speaker']) || 'Doctor',
      Text: pickString(r, ['Text', 'text'])
    };
  });
}

function emptyMedicine(): AiConversationMedicine {
  return {
    Name: '',
    Strength: '',
    Dose: '',
    Frequency: '',
    Route: '',
    DurationDays: '',
    Instructions: '',
    ScheduleCategory: ''
  };
}

export function emptyAiConversationPrescription(): AiConversationPrescription {
  return {
    Complaint: '',
    History: '',
    Diagnosis: '',
    Medicines: [],
    Investigations: [],
    Advice: '',
    FollowUpAdvice: '',
    Allergies: '',
    ClinicalNotes: ''
  };
}

function parseMedicines(raw: unknown): AiConversationMedicine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (typeof row === 'string') {
        const med = emptyMedicine();
        med.Name = row.trim();
        return med;
      }
      const r = asRecord(row);
      return {
        Name: pickString(r, ['Name', 'name']),
        Strength: pickString(r, ['Strength', 'strength']),
        Dose: pickString(r, ['Dose', 'dose']),
        Frequency: pickString(r, ['Frequency', 'frequency']),
        Route: pickString(r, ['Route', 'route']),
        DurationDays: pickString(r, ['DurationDays', 'durationDays']),
        Instructions: pickString(r, ['Instructions', 'instructions']),
        ScheduleCategory: pickString(r, ['ScheduleCategory', 'scheduleCategory'])
      };
    })
    .filter((m) => m.Name.trim());
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

export function parseAiConversationPrescription(raw: unknown): AiConversationPrescription {
  const r = asRecord(raw);
  if (!Object.keys(r).length) return emptyAiConversationPrescription();
  return {
    Complaint: pickString(r, ['Complaint', 'complaint', 'ChiefComplaint', 'chiefComplaint']),
    History: pickString(r, ['History', 'history']),
    Diagnosis: pickString(r, ['Diagnosis', 'diagnosis']),
    Medicines: parseMedicines(r.Medicines ?? r.medicines),
    Investigations: parseStringList(r.Investigations ?? r.investigations),
    Advice: pickString(r, ['Advice', 'advice', 'GeneralAdvice', 'generalAdvice']),
    FollowUpAdvice: pickString(r, ['FollowUpAdvice', 'followUpAdvice', 'FollowUp', 'followUp']),
    Allergies: pickString(r, ['Allergies', 'allergies']),
    ClinicalNotes: pickString(r, ['ClinicalNotes', 'clinicalNotes'])
  };
}

export function formatAiConversationPrescription(rx: AiConversationPrescription): string {
  const lines: string[] = [];
  if (rx.Complaint.trim()) lines.push('Complaint:', rx.Complaint.trim(), '');
  if (rx.History.trim()) lines.push('History:', rx.History.trim(), '');
  if (rx.Allergies.trim()) lines.push('Allergies:', rx.Allergies.trim(), '');
  if (rx.Diagnosis.trim()) lines.push('Diagnosis:', rx.Diagnosis.trim(), '');
  lines.push('Medicines:');
  if (!rx.Medicines.length) {
    lines.push('—');
  } else {
    for (const m of rx.Medicines) {
      const parts = [
        m.Name,
        m.Strength,
        m.Dose,
        m.Frequency,
        m.Route,
        m.DurationDays && `${m.DurationDays}d`,
        m.Instructions
      ]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean);
      lines.push(parts.join(' · '));
    }
  }
  if (rx.Investigations.length) {
    lines.push('', 'Investigations:');
    for (const inv of rx.Investigations) lines.push(inv);
  }
  if (rx.Advice.trim()) lines.push('', 'Advice:', rx.Advice.trim());
  if (rx.FollowUpAdvice.trim()) lines.push('', 'Follow-up:', rx.FollowUpAdvice.trim());
  if (rx.ClinicalNotes.trim()) lines.push('', 'Notes:', rx.ClinicalNotes.trim());
  return lines.join('\n').trim();
}

function parseSession(body: unknown): AiConversationSession {
  const envelope = asRecord(body);
  const data = asRecord(envelope.Data ?? envelope.data);
  return {
    sessionId: pickString(data, ['SessionId', 'sessionId']),
    appointmentId: pickString(data, ['AppointmentId', 'appointmentId']),
    status: pickString(data, ['Status', 'status']),
    durationSeconds: (() => {
      const n = data.DurationSeconds ?? data.durationSeconds;
      return typeof n === 'number' && Number.isFinite(n) ? n : null;
    })(),
    chunkCount: (() => {
      const n = data.ChunkCount ?? data.chunkCount;
      return typeof n === 'number' && Number.isFinite(n) ? n : 0;
    })(),
    languageDetected: pickString(data, ['LanguageDetected', 'languageDetected']),
    languageHint: pickString(data, ['LanguageHint', 'languageHint']),
    audioUrl: pickString(data, ['AudioUrl', 'audioUrl']),
    transcriptText: pickString(data, ['TranscriptText', 'transcriptText']),
    transcript: parseTurns(data.Transcript ?? data.transcript),
    speakersSwapped: Boolean(data.SpeakersSwapped ?? data.speakersSwapped),
    structuredJson: asRecord(data.StructuredJson ?? data.structuredJson),
    summary: asRecord(data.Summary ?? data.summary),
    soap: asRecord(data.Soap ?? data.soap),
    prescription: parseAiConversationPrescription(data.Prescription ?? data.prescription),
    committed: Boolean(data.Committed ?? data.committed),
    message: pickString(envelope, ['Message', 'message'])
  };
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  return toUserFacingApiError(err, fallback);
}

/** Wait until NetInfo reports online (or timeout). */
export async function waitForNetwork(timeoutMs = 120_000): Promise<boolean> {
  if (!useNetworkStore.getState().isOffline && !isLikelyOffline()) {
    return true;
  }
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    if (!useNetworkStore.getState().isOffline) {
      return true;
    }
  }
  return false;
}

export async function withRetries<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { attempts?: number; delayMs?: number }
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  const delayMs = options?.delayMs ?? 2000;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (useNetworkStore.getState().isOffline) {
      const online = await waitForNetwork(60_000);
      if (!online) {
        throw new Error('OFFLINE');
      }
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const ax = err as { response?: { status?: number }; message?: string };
      const status = ax.response?.status;
      const retryable =
        !status ||
        status >= 500 ||
        status === 408 ||
        status === 429 ||
        /offline|network|timeout|taking too long/i.test(String(ax.message ?? err));
      if (!retryable || i === attempts - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

export async function loadDoctorAppointmentsForAiConversation(): Promise<AppointmentOption[]> {
  const { data } = await apiClient.get(SERVER_PATHS.appointmentGet, {
    params: { page: 0, size: 50, sort: 'createdTimestamp,desc' },
    timeout: PIPELINE_TIMEOUT_MS
  });
  const envelope = asRecord(data);
  const rows = Array.isArray(envelope.Data) ? envelope.Data : [];
  return rows
    .map((row) => {
      const r = asRecord(row);
      const id = pickString(r, ['ExternalId', 'externalId', 'Id', 'id']);
      const name = pickString(r, ['PatientName', 'patientName']) || 'Patient';
      const date = pickString(r, ['PreferredDate', 'preferredDate']);
      const slot = pickString(r, ['PreferredTimeSlot', 'preferredTimeSlot']);
      const label = [name, date, slot].filter(Boolean).join(' · ');
      return { id, label, value: id };
    })
    .filter((a) => a.id);
}

export async function startAiConversation(input: {
  appointmentId: string;
  languageHint: string;
  consentAcknowledged: boolean;
}): Promise<AiConversationSession> {
  const { data } = await apiClient.post(
    SERVER_PATHS.audioStart,
    {
      AppointmentId: input.appointmentId,
      LanguageHint: input.languageHint,
      ConsentAcknowledged: input.consentAcknowledged
    },
    { timeout: PIPELINE_TIMEOUT_MS }
  );
  return parseSession(data);
}

export async function uploadAiConversationAudio(input: {
  sessionId: string;
  durationSeconds: number;
  fileUri: string;
  filename?: string;
  mimeType?: string;
  chunkIndex?: number;
}): Promise<AiConversationSession> {
  const filename = input.filename || 'consultation.m4a';
  const mimeType = input.mimeType || 'audio/mp4';
  // Spring binds these from the query string (more reliable than File.upload form parameters).
  const qs = new URLSearchParams({
    SessionId: input.sessionId,
    DurationSeconds: String(Math.max(0, Math.floor(input.durationSeconds)))
  });
  if (input.chunkIndex != null && Number.isFinite(input.chunkIndex)) {
    qs.set('ChunkIndex', String(Math.max(0, Math.floor(input.chunkIndex))));
  }
  const body = await postMultipartLocalFile(
    `${SERVER_PATHS.audioUpload}?${qs.toString()}`,
    input.fileUri,
    filename,
    mimeType,
    { fieldName: 'file' }
  );
  return parseSession(body);
}

export async function transcribeAiConversation(
  sessionId: string,
  swapSpeakers = false
): Promise<AiConversationSession> {
  const { data } = await apiClient.post(
    SERVER_PATHS.audioTranscribe,
    { SessionId: sessionId, SwapSpeakers: swapSpeakers },
    { timeout: PIPELINE_TIMEOUT_MS }
  );
  return parseSession(data);
}

export async function analyzeAiConversation(sessionId: string): Promise<AiConversationSession> {
  const { data } = await apiClient.post(
    SERVER_PATHS.audioAnalyze,
    { SessionId: sessionId },
    { timeout: PIPELINE_TIMEOUT_MS }
  );
  return parseSession(data);
}

export async function generateAiConversationSummary(sessionId: string): Promise<AiConversationSession> {
  const { data } = await apiClient.post(
    SERVER_PATHS.audioGenerateSummary,
    { SessionId: sessionId },
    { timeout: PIPELINE_TIMEOUT_MS }
  );
  return parseSession(data);
}

export async function generateAiConversationPrescription(sessionId: string): Promise<AiConversationSession> {
  const { data } = await apiClient.post(
    SERVER_PATHS.audioGeneratePrescription,
    { SessionId: sessionId },
    { timeout: PIPELINE_TIMEOUT_MS }
  );
  return parseSession(data);
}

export async function applyAiConversationToEprescription(input: {
  sessionId: string;
  prescription: AiConversationPrescription;
}): Promise<AiConversationSession> {
  const { data } = await apiClient.post(
    SERVER_PATHS.audioApplyToEprescription,
    { SessionId: input.sessionId, Prescription: input.prescription },
    { timeout: PIPELINE_TIMEOUT_MS }
  );
  return parseSession(data);
}

export async function saveAiConversation(input: {
  sessionId: string;
  transcriptText: string;
  transcript: AiConversationTurn[];
  structuredJson: Record<string, unknown>;
  summary: Record<string, unknown>;
  soap: Record<string, unknown>;
  prescription: AiConversationPrescription;
}): Promise<AiConversationSession> {
  const { data } = await apiClient.post(
    SERVER_PATHS.audioSave,
    {
      SessionId: input.sessionId,
      TranscriptText: input.transcriptText,
      Transcript: input.transcript,
      StructuredJson: input.structuredJson,
      Summary: input.summary,
      Soap: input.soap,
      Prescription: input.prescription
    },
    { timeout: PIPELINE_TIMEOUT_MS }
  );
  return parseSession(data);
}
