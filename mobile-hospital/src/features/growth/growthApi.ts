import { apiClient } from '@/services/api/client';
import { SERVER_PATHS } from '@saas-builder/hospital-api-client';

export type GrowthMetric = 'wfa' | 'lhfa' | 'bfa' | 'hcfa';

export async function listChildProfilesMobile() {
  const res = await apiClient.get(SERVER_PATHS.childProfiles, { params: { page: 0, size: 50 } });
  return res.data;
}

export async function saveGrowthRecordMobile(payload: Record<string, unknown>) {
  const res = await apiClient.post(`${SERVER_PATHS.growthRecords}/save`, payload);
  return res.data;
}

export async function fetchGrowthChartContextMobile(childId: string, metric: GrowthMetric) {
  const res = await apiClient.get(
    `${SERVER_PATHS.childProfiles}/${encodeURIComponent(childId)}/growth/chart-context`,
    { params: { Metric: metric, FromMonths: 0, ToMonths: 60 } }
  );
  return res.data;
}
