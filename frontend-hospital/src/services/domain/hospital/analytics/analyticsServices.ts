import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import {
  defaultAnalyticsDateRange,
  downloadAnalyticsCsv,
  fetchAnalyticsDoctors,
  fetchAnalyticsOverview,
  fetchAnalyticsTrend
} from '../../../http/analyticsApi';

function setAnalytics(patch: Record<string, unknown>): void {
  const appStore = useAppStore(pinia);
  const current = (appStore.getData('hospital', 'AnalyticsDashboard') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'AnalyticsDashboard', { ...current, ...patch });
}

export const analyticsHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-analytics-dashboard',
    execute: async () => {
      const range = defaultAnalyticsDateRange();
      setAnalytics({
        loading: true,
        error: '',
        dateFrom: range.from,
        dateTo: range.to,
        rangePreset: '30d',
        filteredDoctorId: '',
        filteredDoctorName: ''
      });
      try {
        const appStore = useAppStore(pinia);
        const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
        const role = String(auth.role ?? '').trim().toUpperCase();
        const state = (appStore.getData('hospital', 'AnalyticsDashboard') ?? {}) as Record<string, unknown>;
        const doctorId = String(state.filteredDoctorId ?? '').trim() || undefined;
        const overview = await fetchAnalyticsOverview({
          from: String(state.dateFrom ?? range.from),
          to: String(state.dateTo ?? range.to),
          doctorId
        });
        let doctors: unknown[] = [];
        if (role === 'ADMIN') {
          doctors = await fetchAnalyticsDoctors({
            from: String(state.dateFrom ?? range.from),
            to: String(state.dateTo ?? range.to)
          });
        }
        setAnalytics({ loading: false, overview, doctors, error: '' });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to load analytics.'
          : 'Unable to load analytics.';
        setAnalytics({ loading: false, error: message });
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'ANALYTICS_LOAD_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'fetch-analytics-trend',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const state = (appStore.getData('hospital', 'AnalyticsDashboard') ?? {}) as Record<string, unknown>;
      const from = String(request.data?.from ?? state.dateFrom ?? '').trim();
      const to = String(request.data?.to ?? state.dateTo ?? '').trim();
      const doctorId = String(state.filteredDoctorId ?? '').trim() || undefined;
      try {
        const trend = await fetchAnalyticsTrend({ from, to, doctorId });
        const overview = (state.overview ?? {}) as Record<string, unknown>;
        setAnalytics({
          dateFrom: from,
          dateTo: to,
          overview: { ...overview, DailyTrend: trend }
        });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to refresh trend.'
          : 'Unable to refresh trend.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'ANALYTICS_TREND_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-analytics-date-range',
    execute: async (request) => {
      const preset = String(request.data?.preset ?? '').trim();
      const to = new Date();
      const from = new Date();
      if (preset === '7d') from.setDate(to.getDate() - 6);
      else if (preset === '90d') from.setDate(to.getDate() - 89);
      else from.setDate(to.getDate() - 29);
      const dateFrom = String(request.data?.from ?? from.toISOString().slice(0, 10));
      const dateTo = String(request.data?.to ?? to.toISOString().slice(0, 10));
      setAnalytics({ dateFrom, dateTo, rangePreset: preset || 'custom' });
      const svc = analyticsHospitalServices.find((s) => s.serviceId === 'init-analytics-dashboard');
      if (svc) await svc.execute({ data: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'filter-analytics-doctor',
    execute: async (request) => {
      setAnalytics({
        filteredDoctorId: String(request.data?.doctorId ?? '').trim(),
        filteredDoctorName: String(request.data?.doctorName ?? '').trim()
      });
      const svc = analyticsHospitalServices.find((s) => s.serviceId === 'init-analytics-dashboard');
      if (svc) await svc.execute({ data: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'clear-analytics-doctor-filter',
    execute: async () => {
      setAnalytics({ filteredDoctorId: '', filteredDoctorName: '' });
      const svc = analyticsHospitalServices.find((s) => s.serviceId === 'init-analytics-dashboard');
      if (svc) await svc.execute({ data: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'export-analytics-csv',
    execute: async (request) => {
      const type = String(request.data?.type ?? 'appointments').trim() as 'appointments' | 'patients' | 'retention';
      const appStore = useAppStore(pinia);
      const state = (appStore.getData('hospital', 'AnalyticsDashboard') ?? {}) as Record<string, unknown>;
      try {
        await downloadAnalyticsCsv(type, {
          from: String(state.dateFrom ?? ''),
          to: String(state.dateTo ?? ''),
          doctorId: String(state.filteredDoctorId ?? '').trim() || undefined
        });
        return ok();
      } catch {
        useToastStore(pinia).show('Export failed — please try again.', 'error');
        return { responseCode: 'ANALYTICS_EXPORT_FAILED', message: 'Export failed' };
      }
    }
  }
];
