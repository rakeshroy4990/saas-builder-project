import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';
import { parsePagedEntityList, pickString } from '@saas-builder/hospital-api-client';

export interface TriageAnalyzePayload {
  ChildDisplayName?: string;
  ChildAgeMonths: number;
  ChildWeightKg?: number;
  ReportedSymptoms: string[];
  SymptomDurationHours?: number;
  SymptomSeverity: 'MILD' | 'MODERATE' | 'SEVERE';
  AdditionalNotes?: string;
  AppointmentExternalId?: string;
}

export interface TriageResultRow {
  externalId: string;
  appointmentExternalId?: string | null;
  childDisplayName?: string | null;
  childAgeMonths: number;
  urgencyLevel: string;
  urgencyReasoning: string;
  doctorNote: string;
  redFlags: string[];
  confidence?: string | null;
  createdAt?: string | null;
}

export function parseTriageRow(body: unknown): TriageResultRow | null {
  const data = (body as { Data?: unknown })?.Data ?? body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const externalId = pickString(row, ['ExternalId', 'externalId']);
  if (!externalId) return null;
  const redRaw = row.RedFlags ?? row.redFlags;
  const redFlags = Array.isArray(redRaw)
    ? redRaw.map((f) => String(f ?? '').trim()).filter(Boolean)
    : [];
  return {
    externalId,
    appointmentExternalId: pickString(row, ['AppointmentExternalId', 'appointmentExternalId']) || null,
    childDisplayName: pickString(row, ['ChildDisplayName', 'childDisplayName']) || null,
    childAgeMonths: Number(row.ChildAgeMonths ?? row.childAgeMonths ?? 0),
    urgencyLevel: pickString(row, ['UrgencyLevel', 'urgencyLevel']),
    urgencyReasoning: pickString(row, ['UrgencyReasoning', 'urgencyReasoning']),
    doctorNote: pickString(row, ['DoctorNote', 'doctorNote']),
    redFlags,
    confidence: pickString(row, ['Confidence', 'confidence']) || null,
    createdAt: pickString(row, ['CreatedAt', 'createdAt']) || null
  };
}

export async function analyzeTriage(payload: TriageAnalyzePayload): Promise<TriageResultRow> {
  const res = await apiClient.post(SERVER_PATHS.triageResultsAnalyze, payload);
  const row = parseTriageRow(res.data);
  if (!row) throw new Error(pickString(res.data as Record<string, unknown>, ['Message', 'message']) || 'Triage failed');
  return row;
}

export async function fetchTriageForAppointmentId(appointmentId: string): Promise<TriageResultRow | null> {
  try {
    const path = `${SERVER_PATHS.triageResults}/appointment-id/${encodeURIComponent(appointmentId)}`;
    const res = await apiClient.get(path);
    return parseTriageRow(res.data);
  } catch {
    return null;
  }
}

export async function linkTriageToAppointment(externalId: string, appointmentExternalId: string): Promise<TriageResultRow> {
  const res = await apiClient.post(`${SERVER_PATHS.triageResults}/save`, {
    ExternalId: externalId,
    AppointmentExternalId: appointmentExternalId
  });
  const row = parseTriageRow(res.data);
  if (!row) throw new Error('Link failed');
  return row;
}

export async function listTriageHistory(page = 0, size = 20): Promise<{ rows: TriageResultRow[]; total: number }> {
  const res = await apiClient.get(SERVER_PATHS.triageResults, { params: { page, size } });
  const parsed = parsePagedEntityList(res.data, (row) => {
    if (!row || typeof row !== 'object') return null;
    return parseTriageRow({ Data: row });
  });
  return { rows: parsed.items.filter(Boolean) as TriageResultRow[], total: parsed.totalCount };
}

export function isTriageFresh(createdAt?: string | null, hours = 24): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs < hours * 60 * 60 * 1000;
}
