import { apiClient } from './apiClient';
import { URLRegistry } from './URLRegistry';
import { pickString } from '../domain/hospital/shared/strings';

export type AnalyticsOverview = Record<string, unknown>;

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultAnalyticsDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: formatIsoDate(from), to: formatIsoDate(to) };
}

export async function fetchAnalyticsOverview(params: {
  from: string;
  to: string;
  doctorId?: string;
}): Promise<AnalyticsOverview> {
  const response = await apiClient.get(URLRegistry.paths.analyticsOverview, {
    params: {
      From: params.from,
      To: params.to,
      ...(params.doctorId ? { DoctorId: params.doctorId } : {})
    }
  });
  const envelope = (response.data ?? {}) as Record<string, unknown>;
  const data = envelope.Data ?? envelope.data;
  return (data && typeof data === 'object' ? data : {}) as AnalyticsOverview;
}

export async function fetchAnalyticsTrend(params: {
  from: string;
  to: string;
  doctorId?: string;
}): Promise<unknown[]> {
  const response = await apiClient.get(URLRegistry.paths.analyticsTrend, {
    params: {
      From: params.from,
      To: params.to,
      ...(params.doctorId ? { DoctorId: params.doctorId } : {})
    }
  });
  const envelope = (response.data ?? {}) as Record<string, unknown>;
  const data = envelope.Data ?? envelope.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchAnalyticsDoctors(params: {
  from: string;
  to: string;
}): Promise<unknown[]> {
  const response = await apiClient.get(URLRegistry.paths.analyticsDoctors, {
    params: { From: params.from, To: params.to }
  });
  const envelope = (response.data ?? {}) as Record<string, unknown>;
  const data = envelope.Data ?? envelope.data;
  return Array.isArray(data) ? data : [];
}

export async function downloadAnalyticsCsv(
  type: 'appointments' | 'patients' | 'retention',
  params: { from?: string; to?: string; doctorId?: string }
): Promise<void> {
  const pathKey =
    type === 'appointments'
      ? 'analyticsExportAppointments'
      : type === 'patients'
        ? 'analyticsExportPatients'
        : 'analyticsExportRetention';
  const path = URLRegistry.paths[pathKey];
  const response = await apiClient.get(path, {
    params: {
      ...(params.from ? { From: params.from } : {}),
      ...(params.to ? { To: params.to } : {}),
      ...(params.doctorId ? { DoctorId: params.doctorId } : {})
    },
    responseType: 'blob'
  });
  const blob = response.data as Blob;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `agastya_analytics_${type}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function pickOverviewMessage(payload: unknown): string {
  return pickString((payload ?? {}) as Record<string, unknown>, ['Message', 'message']);
}
