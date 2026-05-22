import { SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';
import { useSessionStore } from '@/auth/sessionStore';

import { extractAppointmentList, normalizeAppointmentRow, type AppointmentSummary } from './types';

export async function fetchAppointmentsPage(page = 0, size = 20): Promise<AppointmentSummary[]> {
  const role = String(useSessionStore.getState().user?.role ?? '').toUpperCase();
  const path = role === 'ADMIN' ? SERVER_PATHS.adminAppointments : SERVER_PATHS.appointmentGet;
  const response = await apiClient.get(path, { params: { page, size } });
  return extractAppointmentList(response.data);
}

export async function fetchAppointmentById(externalId: string): Promise<AppointmentSummary | null> {
  const response = await apiClient.get(`${SERVER_PATHS.appointmentGet}/${encodeURIComponent(externalId)}`);
  const data = unwrapEnvelope<unknown>(response.data);
  if (Array.isArray(data) && data.length > 0) {
    return normalizeAppointmentRow(data[0], 0);
  }
  if (data && typeof data === 'object') {
    return normalizeAppointmentRow(data, 0);
  }
  return null;
}
