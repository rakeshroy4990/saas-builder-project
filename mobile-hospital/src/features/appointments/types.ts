import { pickString } from '@saas-builder/hospital-api-client';

import { useSessionStore } from '@/auth/sessionStore';

import { computeCanStartVideoCall } from './canStartVideoCall';

export interface AppointmentSummary {
  id: string;
  patientName: string;
  doctorName: string;
  preferredDate: string;
  preferredTimeSlot: string;
  status: string;
  department: string;
  doctorId: string;
  createdBy: string;
  canStartVideoCall: boolean;
}

export function normalizeAppointmentRow(entry: unknown, index: number): AppointmentSummary {
  const row = resolveRow(entry);
  const id = pickString(row, ['Id', 'id']) || `appointment-${index}`;
  const preferredDate = pickString(row, ['PreferredDate', 'preferredDate']);
  const preferredTimeSlot = pickString(row, ['PreferredTimeSlot', 'preferredTimeSlot']);
  const status = pickString(row, ['Status', 'status']) || 'SCHEDULED';
  const doctorId = pickString(row, ['DoctorId', 'doctorId']);
  const createdBy = pickString(row, ['CreatedBy', 'createdBy']);
  const session = useSessionStore.getState().user;
  const role = String(session?.role ?? '').toUpperCase();
  const myUserId = String(session?.userId ?? '').trim();
  const canStartVideoCall = computeCanStartVideoCall(
    { status, preferredDate, preferredTimeSlot },
    role,
    myUserId,
    createdBy
  );
  return {
    id,
    patientName: pickString(row, ['PatientName', 'patientName']) || 'Patient',
    doctorName:
      pickString(row, ['DoctorName', 'doctorName', 'AssignedDoctorName', 'assignedDoctorName']) || 'Doctor',
    preferredDate,
    preferredTimeSlot,
    status,
    department: pickString(row, ['Department', 'department']),
    doctorId,
    createdBy,
    canStartVideoCall
  };
}

function resolveRow(entry: unknown): Record<string, unknown> {
  const row = (entry ?? {}) as Record<string, unknown>;
  const nested = (row.Data ?? row.data ?? row.Item ?? row.item) as unknown;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return row;
}

export function extractAppointmentList(raw: unknown): AppointmentSummary[] {
  const dataNode = unwrapListNode(raw);
  const rows = Array.isArray(dataNode)
    ? dataNode
    : Array.isArray((dataNode as Record<string, unknown>)?.content)
      ? ((dataNode as Record<string, unknown>).content as unknown[])
      : [];
  return rows.map((entry, idx) => normalizeAppointmentRow(entry, idx));
}

function unwrapListNode(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return [];
  const envelope = raw as Record<string, unknown>;
  return envelope.Data ?? envelope.data ?? [];
}
