import type { GrowthMetric } from '@/features/growth/growthApi';

export const BMI_PERCENTILE_DISPLAY_MIN = 40;

export type GrowthRecordRow = {
  externalId: string;
  recordedAt: string;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  weightPercentile: number | null;
  heightPercentile: number | null;
  bmiPercentile: number | null;
};

export const GROWTH_METRICS: GrowthMetric[] = ['wfa', 'lhfa', 'bfa', 'hcfa'];

export const METRIC_LABEL_KEYS: Record<GrowthMetric, string> = {
  wfa: 'growth.metric.weight',
  lhfa: 'growth.metric.height',
  bfa: 'growth.metric.bmi',
  hcfa: 'growth.metric.headCirc'
};

export const METRIC_GUIDE_KEYS: Record<GrowthMetric, string> = {
  wfa: 'growth.metricGuide.weight',
  lhfa: 'growth.metricGuide.height',
  bfa: 'growth.metricGuide.bmi',
  hcfa: 'growth.metricGuide.headCirc'
};

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function parseGrowthRecord(row: Record<string, unknown>): GrowthRecordRow {
  return {
    externalId: pickString(row, ['ExternalId', 'externalId']),
    recordedAt: pickString(row, ['RecordedAt', 'recordedAt']),
    weightKg: pickNumber(row, ['WeightKg', 'weightKg']),
    heightCm: pickNumber(row, ['HeightCm', 'heightCm']),
    headCircumferenceCm: pickNumber(row, ['HeadCircumferenceCm', 'headCircumferenceCm']),
    weightPercentile: pickNumber(row, ['WeightPercentile', 'weightPercentile']),
    heightPercentile: pickNumber(row, ['HeightPercentile', 'heightPercentile']),
    bmiPercentile: pickNumber(row, ['BmiPercentile', 'bmiPercentile'])
  };
}

export function parseGrowthRecords(rows: unknown): GrowthRecordRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => parseGrowthRecord(row as Record<string, unknown>));
}

export function sortRecordsDesc(records: GrowthRecordRow[]): GrowthRecordRow[] {
  return [...records].sort(
    (left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt)
  );
}

export function formatPercentileDisplay(percentile: number | null | undefined): string {
  if (percentile == null) return '—';
  return `${Math.round(percentile)}%`;
}

export function formatBmiPercentileDisplay(percentile: number | null | undefined): string {
  if (percentile == null || percentile < BMI_PERCENTILE_DISPLAY_MIN) return '—';
  return `${Math.round(percentile)}%`;
}

export function percentileBadgeColors(
  percentile: number | null | undefined,
  kind: 'weight' | 'height' | 'bmi'
): { backgroundColor: string; color: string } {
  if (kind === 'bmi' && (percentile == null || percentile < BMI_PERCENTILE_DISPLAY_MIN)) {
    return { backgroundColor: '#f1f5f9', color: '#64748b' };
  }
  if (percentile == null) {
    return { backgroundColor: '#f1f5f9', color: '#334155' };
  }
  if (percentile < 3 || percentile > 97) {
    return { backgroundColor: '#fee2e2', color: '#991b1b' };
  }
  if (percentile < 15 || percentile > 85) {
    return { backgroundColor: '#fef3c7', color: '#92400e' };
  }
  return { backgroundColor: '#d1fae5', color: '#065f46' };
}

export function todayDateInput(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function recordedDateToIso(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return `${todayDateInput()}T12:00:00.000Z`;
  return `${trimmed}T12:00:00.000Z`;
}

export function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}
