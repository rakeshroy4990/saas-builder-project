import { apiClient } from './apiClient';
import { resolveSpringApiUrl, SERVER_PATHS } from './apiPaths';
import { pickString } from '../domain/hospital/shared/strings';

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

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
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
  return raw.map((row) => {
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
  }).filter((m) => m.Name.trim());
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

/** Doctor-facing text matching OPD / safety-summary style (Diagnosis + Medicines sections). */
export function formatAiConversationPrescription(rx: AiConversationPrescription): string {
  const lines: string[] = [];
  if (rx.Complaint.trim()) {
    lines.push('Complaint:', rx.Complaint.trim(), '');
  }
  if (rx.History.trim()) {
    lines.push('History:', rx.History.trim(), '');
  }
  if (rx.Allergies.trim()) {
    lines.push('Allergies:', rx.Allergies.trim(), '');
  }
  if (rx.Diagnosis.trim()) {
    lines.push('Diagnosis:', rx.Diagnosis.trim(), '');
  }
  lines.push('Medicines:');
  if (!rx.Medicines.length) {
    lines.push('—');
  } else {
    for (const m of rx.Medicines) {
      const parts = [m.Name, m.Strength, m.Dose, m.Frequency, m.Route, m.DurationDays && `${m.DurationDays}d`, m.Instructions]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean);
      lines.push(parts.join(' · '));
    }
  }
  if (rx.Investigations.length) {
    lines.push('', 'Investigations:');
    for (const inv of rx.Investigations) lines.push(inv);
  }
  if (rx.Advice.trim()) {
    lines.push('', 'Advice:', rx.Advice.trim());
  }
  if (rx.FollowUpAdvice.trim()) {
    lines.push('', 'Follow-up:', rx.FollowUpAdvice.trim());
  }
  if (rx.ClinicalNotes.trim()) {
    lines.push('', 'Notes:', rx.ClinicalNotes.trim());
  }
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

export async function startAiConversation(input: {
  appointmentId: string;
  languageHint: string;
  consentAcknowledged: boolean;
}): Promise<AiConversationSession> {
  const { data } = await apiClient.post(SERVER_PATHS.audioStart, {
    AppointmentId: input.appointmentId,
    LanguageHint: input.languageHint,
    ConsentAcknowledged: input.consentAcknowledged
  });
  return parseSession(data);
}

export async function uploadAiConversationAudio(input: {
  sessionId: string;
  durationSeconds: number;
  blob: Blob;
  filename?: string;
  chunkIndex?: number;
}): Promise<AiConversationSession> {
  const form = new FormData();
  form.append('SessionId', input.sessionId);
  form.append('DurationSeconds', String(Math.max(0, Math.floor(input.durationSeconds))));
  if (input.chunkIndex != null && Number.isFinite(input.chunkIndex)) {
    form.append('ChunkIndex', String(Math.max(0, Math.floor(input.chunkIndex))));
  }
  form.append('file', input.blob, input.filename || 'consultation.webm');
  const { data } = await apiClient.post(SERVER_PATHS.audioUpload, form);
  return parseSession(data);
}

/** Best-effort flush for pagehide / unload (httpOnly cookies via credentials). */
export function uploadAiConversationChunkKeepalive(input: {
  sessionId: string;
  durationSeconds: number;
  chunkIndex: number;
  blob: Blob;
  filename?: string;
}): void {
  const form = new FormData();
  form.append('SessionId', input.sessionId);
  form.append('DurationSeconds', String(Math.max(0, Math.floor(input.durationSeconds))));
  form.append('ChunkIndex', String(Math.max(0, Math.floor(input.chunkIndex))));
  form.append('file', input.blob, input.filename || 'chunk.webm');
  const url = resolveSpringApiUrl(SERVER_PATHS.audioUpload);
  void fetch(url, { method: 'POST', body: form, keepalive: true, credentials: 'include' });
}

export async function transcribeAiConversation(
  sessionId: string,
  swapSpeakers = false
): Promise<AiConversationSession> {
  const { data } = await apiClient.post(SERVER_PATHS.audioTranscribe, {
    SessionId: sessionId,
    SwapSpeakers: swapSpeakers
  });
  return parseSession(data);
}

export async function analyzeAiConversation(sessionId: string): Promise<AiConversationSession> {
  const { data } = await apiClient.post(SERVER_PATHS.audioAnalyze, { SessionId: sessionId });
  return parseSession(data);
}

export async function generateAiConversationSummary(sessionId: string): Promise<AiConversationSession> {
  const { data } = await apiClient.post(SERVER_PATHS.audioGenerateSummary, { SessionId: sessionId });
  return parseSession(data);
}

export async function generateAiConversationPrescription(sessionId: string): Promise<AiConversationSession> {
  const { data } = await apiClient.post(SERVER_PATHS.audioGeneratePrescription, { SessionId: sessionId });
  return parseSession(data);
}

export async function applyAiConversationToEprescription(input: {
  sessionId: string;
  prescription: AiConversationPrescription;
}): Promise<AiConversationSession> {
  const { data } = await apiClient.post(SERVER_PATHS.audioApplyToEprescription, {
    SessionId: input.sessionId,
    Prescription: input.prescription
  });
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
  const { data } = await apiClient.post(SERVER_PATHS.audioSave, {
    SessionId: input.sessionId,
    TranscriptText: input.transcriptText,
    Transcript: input.transcript,
    StructuredJson: input.structuredJson,
    Summary: input.summary,
    Soap: input.soap,
    Prescription: input.prescription
  });
  return parseSession(data);
}

export async function getAiConversationByAppointment(appointmentId: string): Promise<AiConversationSession> {
  const { data } = await apiClient.get(`${SERVER_PATHS.audioByAppointment}/${encodeURIComponent(appointmentId)}`);
  return parseSession(data);
}
