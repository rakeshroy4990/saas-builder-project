import { pickString } from '@saas-builder/hospital-api-client';

export interface AppointmentSummary {
  id: string;
  patientName: string;
  doctorName: string;
  preferredDate: string;
  preferredTimeSlot: string;
  status: string;
  department: string;
}

export function normalizeAppointmentRow(entry: unknown, index: number): AppointmentSummary {
  const row = resolveRow(entry);
  const id = pickString(row, ['Id', 'id']) || `appointment-${index}`;
  return {
    id,
    patientName: pickString(row, ['PatientName', 'patientName']) || 'Patient',
    doctorName:
      pickString(row, ['DoctorName', 'doctorName', 'AssignedDoctorName', 'assignedDoctorName']) || 'Doctor',
    preferredDate: pickString(row, ['PreferredDate', 'preferredDate']),
    preferredTimeSlot: pickString(row, ['PreferredTimeSlot', 'preferredTimeSlot']),
    status: pickString(row, ['Status', 'status']) || 'SCHEDULED',
    department: pickString(row, ['Department', 'department'])
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
