import { apiClient } from '@/api/client';
import { SERVER_PATHS } from '@saas-builder/hospital-api-client';
import { GROWTH_SUMMARY_TIMEOUT_MS } from '@/api/timeouts';
import { activeMobileLocale } from '@/i18n/locale';

import { recordGrowthHistorySummaryFailure } from '@/features/growth/growthHistorySummaryTelemetry';
import {
  postGrowthHistorySummaryNdjson,
  type GrowthHistorySummaryStreamHandlers
} from '@/features/growth/growthHistorySummaryStream';
import {
  parseGrowthChartContext,
  type GrowthChartContext
} from '@/features/growth/growthChartContext';
import {
  parseGrowthCharacteristics,
  type GrowthCharacteristics
} from '@/features/growth/growthCharacteristics';

export type GrowthMetric = 'wfa' | 'lhfa' | 'bfa' | 'hcfa';

export type GrowthHistorySummaryResult = {
  summary: string;
  characteristics: GrowthCharacteristics | null;
};

let growthSummaryQueue: Promise<unknown> = Promise.resolve();

function runSerializedGrowthSummary<T>(task: () => Promise<T>): Promise<T> {
  const result = growthSummaryQueue.then(task, task);
  growthSummaryQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function pickObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const envelope = data as Record<string, unknown>;
  const row = envelope.Data ?? envelope.data;
  return row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : null;
}

export async function listChildProfilesMobile() {
  const res = await apiClient.get(SERVER_PATHS.childProfiles, { params: { page: 0, size: 50 } });
  return res.data;
}

export async function saveChildProfileMobile(payload: {
  displayName: string;
  dateOfBirth: string;
  sex: 'male' | 'female';
  externalId?: string;
  motherHeightCm?: number | null;
  fatherHeightCm?: number | null;
}) {
  const res = await apiClient.post(`${SERVER_PATHS.childProfiles}/save`, {
    ExternalId: payload.externalId ?? null,
    DisplayName: payload.displayName,
    DateOfBirth: payload.dateOfBirth,
    Sex: payload.sex,
    MotherHeightCm: payload.motherHeightCm ?? null,
    FatherHeightCm: payload.fatherHeightCm ?? null
  });
  return res.data;
}

export async function saveGrowthRecordMobile(payload: Record<string, unknown>) {
  const res = await apiClient.post(`${SERVER_PATHS.growthRecords}/save`, payload);
  return res.data;
}

export async function fetchGrowthChartContextMobile(
  childId: string,
  metric: GrowthMetric
): Promise<GrowthChartContext> {
  const res = await apiClient.get(
    `${SERVER_PATHS.childProfiles}/${encodeURIComponent(childId)}/growth/chart-context`,
    { params: { Metric: metric, metric, fromMonths: 0, toMonths: 60 } }
  );
  const body = (res.data ?? {}) as Record<string, unknown>;
  const data = pickObject(body) ?? {};
  return parseGrowthChartContext(data, metric);
}

async function fetchGrowthHistorySummarySyncMobile(
  payload: Record<string, unknown>
): Promise<GrowthHistorySummaryResult> {
  const res = await apiClient.post(`${SERVER_PATHS.growthRecords}/history-summary`, payload, {
    timeout: GROWTH_SUMMARY_TIMEOUT_MS
  });
  const body = (res.data ?? {}) as Record<string, unknown>;
  if (body.Success === false || body.success === false) {
    throw new Error(String(body.Message ?? body.message ?? 'growth_summary_sync_failed'));
  }
  const data = (body.Data ?? body.data) as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    throw new Error('growth_summary_sync_empty');
  }
  const summary = String(data.Summary ?? data.summary ?? '').trim();
  if (!summary) {
    throw new Error('growth_summary_sync_empty');
  }
  return {
    summary,
    characteristics: parseGrowthCharacteristics(data.Characteristics ?? data.characteristics)
  };
}

export async function fetchGrowthHistorySummaryMobile(
  payload: Record<string, unknown>,
  recordExternalId: string,
  handlers?: GrowthHistorySummaryStreamHandlers
): Promise<GrowthHistorySummaryResult> {
  return runSerializedGrowthSummary(async () => {
    const t0 = Date.now();
    const body = {
      ...payload,
      ReplyLocale: activeMobileLocale()
    };

    try {
      const result = await fetchGrowthHistorySummarySyncMobile(body);
      handlers?.onComplete?.(result.summary, result.characteristics);
      return result;
    } catch (syncErr) {
      try {
        let characteristics: GrowthCharacteristics | null = null;
        const summary = await postGrowthHistorySummaryNdjson(body, {
          ...handlers,
          onComplete: (summaryText, chars) => {
            characteristics = chars ?? characteristics;
            handlers?.onComplete?.(summaryText, chars);
          }
        });
        return { summary, characteristics };
      } catch (streamErr) {
        recordGrowthHistorySummaryFailure(recordExternalId, streamErr ?? syncErr, Date.now() - t0);
        return { summary: '', characteristics: null };
      }
    }
  });
}
