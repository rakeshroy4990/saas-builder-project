import { apiClient } from '@/api/client';
import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

export type AnalyticsOverview = Record<string, unknown>;

function pickData(body: unknown): unknown {
  if (!body || typeof body !== 'object') return null;
  const envelope = body as Record<string, unknown>;
  return envelope.Data ?? envelope.data ?? null;
}

export async function fetchAnalyticsOverviewMobile(params: {
  from: string;
  to: string;
  doctorId?: string;
}): Promise<AnalyticsOverview> {
  const res = await apiClient.get(SERVER_PATHS.analyticsOverview, {
    params: {
      From: params.from,
      To: params.to,
      ...(params.doctorId ? { DoctorId: params.doctorId } : {})
    }
  });
  const data = pickData(res.data);
  return (data && typeof data === 'object' ? data : {}) as AnalyticsOverview;
}

export async function fetchAnalyticsDoctorsMobile(params: {
  from: string;
  to: string;
}): Promise<unknown[]> {
  const res = await apiClient.get(SERVER_PATHS.analyticsDoctors, {
    params: { From: params.from, To: params.to }
  });
  const data = pickData(res.data);
  return Array.isArray(data) ? data : [];
}

export async function fetchAnalyticsCsvMobile(
  type: 'appointments' | 'patients' | 'retention',
  params: { from?: string; to?: string; doctorId?: string }
): Promise<string> {
  const path =
    type === 'appointments'
      ? SERVER_PATHS.analyticsExportAppointments
      : type === 'patients'
        ? SERVER_PATHS.analyticsExportPatients
        : SERVER_PATHS.analyticsExportRetention;
  const res = await apiClient.get(path, {
    params: {
      ...(params.from ? { From: params.from } : {}),
      ...(params.to ? { To: params.to } : {}),
      ...(params.doctorId ? { DoctorId: params.doctorId } : {})
    },
    responseType: 'text'
  });
  return String(res.data ?? '');
}

export function defaultAnalyticsRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
