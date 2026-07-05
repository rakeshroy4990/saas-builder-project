import { useQuery } from '@tanstack/react-query';

import { useSessionStore } from '@/auth/sessionStore';
import {
  defaultAnalyticsRange,
  fetchAnalyticsDoctorsMobile,
  fetchAnalyticsOverviewMobile
} from '@/features/analytics/analyticsApi';

export function useAnalyticsOverview(from: string, to: string, doctorId?: string) {
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();
  const userId = String(useSessionStore((s) => s.user?.userId ?? '')).trim();
  const scopedDoctorId = role === 'DOCTOR' ? userId : doctorId;

  return useQuery({
    queryKey: ['analytics-overview', from, to, scopedDoctorId ?? 'all'],
    queryFn: () => fetchAnalyticsOverviewMobile({ from, to, doctorId: scopedDoctorId || undefined }),
    staleTime: 3600000,
    enabled: role === 'ADMIN' || role === 'DOCTOR'
  });
}

export function useAnalyticsDoctors(from: string, to: string) {
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();

  return useQuery({
    queryKey: ['analytics-doctors', from, to],
    queryFn: () => fetchAnalyticsDoctorsMobile({ from, to }),
    staleTime: 3600000,
    enabled: role === 'ADMIN'
  });
}

export function useAnalyticsDateRange() {
  const range = defaultAnalyticsRange();
  return { from: range.from, to: range.to };
}
