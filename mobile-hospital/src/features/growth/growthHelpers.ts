import type { GrowthMetric } from '@/features/growth/growthApi';

export type GrowthRecordRow = {
  externalId: string;
  recordedAt: string;
  ageMonthsAtRecording: number;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  bmi: number | null;
  weightPercentile: number | null;
  heightPercentile: number | null;
  bmiPercentile: number | null;
  hcPercentile: number | null;
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
    ageMonthsAtRecording: pickNumber(row, ['AgeMonthsAtRecording', 'ageMonthsAtRecording']) ?? 0,
    weightKg: pickNumber(row, ['WeightKg', 'weightKg']),
    heightCm: pickNumber(row, ['HeightCm', 'heightCm']),
    headCircumferenceCm: pickNumber(row, ['HeadCircumferenceCm', 'headCircumferenceCm']),
    bmi: pickNumber(row, ['Bmi', 'bmi']),
    weightPercentile: pickNumber(row, ['WeightPercentile', 'weightPercentile']),
    heightPercentile: pickNumber(row, ['HeightPercentile', 'heightPercentile']),
    bmiPercentile: pickNumber(row, ['BmiPercentile', 'bmiPercentile']),
    hcPercentile: pickNumber(row, ['HcPercentile', 'hcPercentile'])
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

export function formatBmiKgM2(record: {
  bmi?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
}): string | null {
  if (record.bmi != null && Number.isFinite(record.bmi)) {
    return record.bmi.toFixed(1);
  }
  const weight = record.weightKg;
  const heightCm = record.heightCm;
  if (weight == null || heightCm == null || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weight / (heightM * heightM);
  if (!Number.isFinite(bmi) || bmi <= 0) return null;
  return bmi.toFixed(1);
}

/** Tall/lean pattern: high height-for-age, typical weight-for-age, low BMI-for-age (WHO). */
export function isTallLeanGrowthPattern(record: {
  heightPercentile?: number | null;
  weightPercentile?: number | null;
  bmiPercentile?: number | null;
}): boolean {
  const heightPct = record.heightPercentile;
  const weightPct = record.weightPercentile;
  const bmiPct = record.bmiPercentile;
  if (heightPct == null || weightPct == null || bmiPct == null) return false;
  return heightPct >= 85 && weightPct >= 15 && weightPct <= 85 && bmiPct < 15;
}

export function percentileBadgeColors(
  percentile: number | null | undefined,
  _kind: 'weight' | 'height' | 'bmi'
): { backgroundColor: string; color: string } {
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

export function isoToDateInput(iso: string): string {
  if (!iso.trim()) return todayDateInput();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayDateInput();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

export function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export type AgeComponents = {
  years: number;
  months: number;
  days: number;
};

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function recordedAtToYmd(recordedAt: string): string {
  const trimmed = String(recordedAt ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return isoToDateInput(trimmed);
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

/** Calendar age from date of birth to the measurement date (UTC date parts). */
export function computeAgeAtDate(dateOfBirth: string, recordedAt: string): AgeComponents | null {
  const dob = parseYmd(dateOfBirth);
  const recorded = parseYmd(recordedAtToYmd(recordedAt));
  if (!dob || !recorded) return null;

  let years = recorded.y - dob.y;
  let months = recorded.m - dob.m;
  let days = recorded.d - dob.d;

  if (days < 0) {
    months -= 1;
    const prevMonth = recorded.m === 1 ? 12 : recorded.m - 1;
    const prevMonthYear = recorded.m === 1 ? recorded.y - 1 : recorded.y;
    days += daysInMonth(prevMonthYear, prevMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  return { years, months, days };
}

export function formatAgeAtRecordingLabel(
  dateOfBirth: string,
  recordedAt: string,
  t: (key: string, options?: Record<string, unknown>) => string
): string | null {
  const age = computeAgeAtDate(dateOfBirth, recordedAt);
  if (!age) return null;
  return t('growth.historyAge', age);
}

export type { GrowthCharacteristics } from '@/features/growth/growthCharacteristics';
export {
  deriveGrowthCharacteristics,
  deriveGrowthTraitCodes,
  parseGrowthCharacteristics,
  resolveGrowthCharacteristics
} from '@/features/growth/growthCharacteristics';
