import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';
import { pickString, pickNumber } from '../domain/hospital/shared/strings';
import { activeAppLocale } from '../../i18n/activeLocale';
import { recordGrowthHistorySummaryFailure } from '../domain/hospital/growth/growthHistorySummaryTelemetry';
import {
  postGrowthHistorySummaryNdjson,
  type GrowthHistorySummaryPayload,
  type GrowthHistorySummaryStreamHandlers
} from './growthHistorySummaryStream';
import {
  parseGrowthCharacteristics,
  type GrowthCharacteristics
} from '../domain/hospital/growth/growthCharacteristics';
import {
  parseMidParentalHeight,
  type MidParentalHeightSummary
} from '../domain/hospital/growth/midParentalHeight';

export type { GrowthCharacteristics, MidParentalHeightSummary };
export {
  buildGrowthProfilePhrase,
  deriveGrowthCharacteristics,
  deriveGrowthTraitCodes,
  parseGrowthCharacteristics,
  resolveGrowthCharacteristics
} from '../domain/hospital/growth/growthCharacteristics';
export { computeMidParentalHeightClient, parseMidParentalHeight } from '../domain/hospital/growth/midParentalHeight';

const GROWTH_SUMMARY_HTTP_TIMEOUT_MS = 120_000;

/** Serialize RAG calls so parallel history rows do not starve browser ↔ Spring connections. */
let growthSummaryQueue: Promise<unknown> = Promise.resolve();

function runSerializedGrowthSummary<T>(task: () => Promise<T>): Promise<T> {
  const result = growthSummaryQueue.then(task, task);
  growthSummaryQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export type GrowthMetric = 'wfa' | 'lhfa' | 'bfa' | 'hcfa';

export interface ChildProfileRow {
  externalId: string;
  displayName: string;
  dateOfBirth: string;
  sex: string;
  bloodGroup?: string | null;
  motherHeightCm?: number | null;
  fatherHeightCm?: number | null;
}

export interface GrowthRecordRow {
  externalId: string;
  childProfileExternalId: string;
  recordedAt: string;
  ageMonthsAtRecording: number;
  heightCm?: number | null;
  weightKg?: number | null;
  headCircumferenceCm?: number | null;
  bmi?: number | null;
  heightPercentile?: number | null;
  weightPercentile?: number | null;
  bmiPercentile?: number | null;
  hcPercentile?: number | null;
  source: string;
  notes?: string | null;
}

export interface WhoCurvePoint {
  ageMonths: number;
  value: number;
}

export interface GrowthChartContext {
  childProfile: ChildProfileRow;
  metric: GrowthMetric;
  records: GrowthRecordRow[];
  percentileCurves: Record<string, WhoCurvePoint[]>;
  latestSummary?: {
    weightPercentile?: number | null;
    heightPercentile?: number | null;
    bmiPercentile?: number | null;
    hcPercentile?: number | null;
    interpretationBand?: string | null;
    characteristics?: GrowthCharacteristics | null;
  } | null;
  midParentalHeight?: MidParentalHeightSummary | null;
}

export interface GrowthHistorySummaryResult {
  summary: string;
  characteristics: GrowthCharacteristics | null;
}

function parseChildProfile(row: Record<string, unknown>): ChildProfileRow {
  return {
    externalId: pickString(row, ['ExternalId', 'externalId']),
    displayName: pickString(row, ['DisplayName', 'displayName']),
    dateOfBirth: pickString(row, ['DateOfBirth', 'dateOfBirth']),
    sex: pickString(row, ['Sex', 'sex']),
    bloodGroup: pickString(row, ['BloodGroup', 'bloodGroup']) || null,
    motherHeightCm: pickNumber(row, ['MotherHeightCm', 'motherHeightCm']),
    fatherHeightCm: pickNumber(row, ['FatherHeightCm', 'fatherHeightCm'])
  };
}

export function parseChildProfileRow(row: unknown): ChildProfileRow | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const parsed = parseChildProfile(row as Record<string, unknown>);
  return parsed.externalId ? parsed : null;
}

export function coalesceParentHeights(
  profile: Pick<ChildProfileRow, 'motherHeightCm' | 'fatherHeightCm'> | null,
  mph: MidParentalHeightSummary | null
): { motherHeightCm: number | null; fatherHeightCm: number | null } {
  return {
    motherHeightCm: profile?.motherHeightCm ?? mph?.motherHeightCm ?? null,
    fatherHeightCm: profile?.fatherHeightCm ?? mph?.fatherHeightCm ?? null
  };
}

export function formatParentHeightInput(cm: number | null | undefined): string {
  if (cm == null || !Number.isFinite(cm)) return '';
  return String(cm);
}

export function parseGrowthRecord(row: Record<string, unknown>): GrowthRecordRow {
  return {
    externalId: pickString(row, ['ExternalId', 'externalId']),
    childProfileExternalId: pickString(row, ['ChildProfileExternalId', 'childProfileExternalId']),
    recordedAt: pickString(row, ['RecordedAt', 'recordedAt']),
    ageMonthsAtRecording: pickNumber(row, ['AgeMonthsAtRecording', 'ageMonthsAtRecording']) ?? 0,
    heightCm: pickNumber(row, ['HeightCm', 'heightCm']),
    weightKg: pickNumber(row, ['WeightKg', 'weightKg']),
    headCircumferenceCm: pickNumber(row, ['HeadCircumferenceCm', 'headCircumferenceCm']),
    bmi: pickNumber(row, ['Bmi', 'bmi']),
    heightPercentile: pickNumber(row, ['HeightPercentile', 'heightPercentile']),
    weightPercentile: pickNumber(row, ['WeightPercentile', 'weightPercentile']),
    bmiPercentile: pickNumber(row, ['BmiPercentile', 'bmiPercentile']),
    hcPercentile: pickNumber(row, ['HcPercentile', 'hcPercentile']),
    source: pickString(row, ['Source', 'source']) || 'manual',
    notes: pickString(row, ['Notes', 'notes']) || null
  };
}

function parseCurvePoints(rows: unknown): WhoCurvePoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      ageMonths: pickNumber(item, ['AgeMonths', 'ageMonths']) ?? 0,
      value: pickNumber(item, ['Value', 'value']) ?? 0
    };
  });
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

export async function listChildProfiles(): Promise<ChildProfileRow[]> {
  const res = await apiClient.get(SERVER_PATHS.childProfiles, { params: { page: 0, size: 50 } });
  const body = res.data as Record<string, unknown>;
  const data = body.Data;
  if (!Array.isArray(data)) return [];
  return data.map((row) => parseChildProfile(row as Record<string, unknown>));
}

export async function listChildProfilesForPatient(patientUserId: string): Promise<ChildProfileRow[]> {
  const query = JSON.stringify({ PatientUserId: patientUserId });
  const res = await apiClient.get(SERVER_PATHS.childProfiles, {
    params: { page: 0, size: 50, Query: query }
  });
  const body = res.data as Record<string, unknown>;
  const data = body.Data;
  if (!Array.isArray(data)) return [];
  return data.map((row) => parseChildProfile(row as Record<string, unknown>));
}

export async function saveChildProfile(payload: {
  externalId?: string;
  displayName: string;
  dateOfBirth: string;
  sex: string;
  bloodGroup?: string;
  motherHeightCm?: number | null;
  fatherHeightCm?: number | null;
}): Promise<ChildProfileRow> {
  const res = await apiClient.post(`${SERVER_PATHS.childProfiles}/save`, {
    ExternalId: payload.externalId ?? null,
    DisplayName: payload.displayName,
    DateOfBirth: payload.dateOfBirth,
    Sex: payload.sex,
    BloodGroup: payload.bloodGroup ?? null,
    MotherHeightCm: payload.motherHeightCm ?? null,
    FatherHeightCm: payload.fatherHeightCm ?? null
  });
  const body = res.data as Record<string, unknown>;
  const data = body.Data as Record<string, unknown>;
  return parseChildProfile(data);
}

export async function saveGrowthRecord(payload: {
  externalId?: string;
  childProfileExternalId: string;
  recordedAt?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  headCircumferenceCm?: number | null;
  source?: string;
  notes?: string;
  appointmentExternalId?: string;
  deviceReadingExternalId?: string;
}): Promise<GrowthRecordRow> {
  const res = await apiClient.post(`${SERVER_PATHS.growthRecords}/save`, {
    ExternalId: payload.externalId ?? null,
    ChildProfileExternalId: payload.childProfileExternalId,
    RecordedAt: payload.recordedAt ?? new Date().toISOString(),
    HeightCm: payload.heightCm ?? null,
    WeightKg: payload.weightKg ?? null,
    HeadCircumferenceCm: payload.headCircumferenceCm ?? null,
    Source: payload.source ?? 'manual',
    Notes: payload.notes ?? null,
    AppointmentExternalId: payload.appointmentExternalId ?? null,
    DeviceReadingExternalId: payload.deviceReadingExternalId ?? null
  });
  const body = res.data as Record<string, unknown>;
  const data = body.Data as Record<string, unknown>;
  return parseGrowthRecord(data);
}

export async function fetchGrowthHistorySummary(
  childProfileExternalId: string,
  record: GrowthRecordRow,
  handlers?: GrowthHistorySummaryStreamHandlers,
  childSex?: string | null
): Promise<GrowthHistorySummaryResult> {
  return runSerializedGrowthSummary(async () => {
    const t0 = Date.now();
    const payload: GrowthHistorySummaryPayload = {
      ChildProfileExternalId: childProfileExternalId,
      AgeMonthsAtRecording: record.ageMonthsAtRecording,
      WeightKg: record.weightKg ?? null,
      HeightCm: record.heightCm ?? null,
      HeadCircumferenceCm: record.headCircumferenceCm ?? null,
      WeightPercentile: record.weightPercentile ?? null,
      HeightPercentile: record.heightPercentile ?? null,
      BmiPercentile: record.bmiPercentile ?? null,
      HcPercentile: record.hcPercentile ?? null,
      ReplyLocale: activeAppLocale(),
      Sex: childSex ?? null
    };

    let characteristics: GrowthCharacteristics | null = null;

    // Prefer sync JSON (~5–10s, one sentence). Stream remains fallback when sync is unavailable.
    try {
      const syncResult = await fetchGrowthHistorySummarySync(payload);
      characteristics = syncResult.characteristics;
      if (syncResult.summary) {
        handlers?.onComplete?.(syncResult.summary, syncResult.characteristics);
      }
      return syncResult;
    } catch (syncErr) {
      try {
        const summary = await postGrowthHistorySummaryNdjson(payload, {
          ...handlers,
          onComplete: (summaryText, chars) => {
            characteristics = chars ?? characteristics;
            handlers?.onComplete?.(summaryText, chars);
          }
        });
        return { summary, characteristics };
      } catch (streamErr) {
        recordGrowthHistorySummaryFailure(record.externalId, streamErr ?? syncErr, Date.now() - t0);
        return { summary: '', characteristics: null };
      }
    }
  });
}

async function fetchGrowthHistorySummarySync(
  payload: GrowthHistorySummaryPayload
): Promise<GrowthHistorySummaryResult> {
  const res = await apiClient.post(`${SERVER_PATHS.growthRecords}/history-summary`, payload, {
    timeout: GROWTH_SUMMARY_HTTP_TIMEOUT_MS
  });
  const body = res.data as Record<string, unknown>;
  if (body.Success === false || body.success === false) {
    throw new Error(String(body.Message ?? body.message ?? 'growth_summary_sync_failed'));
  }
  const data = (body.Data ?? body.data) as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    throw new Error('growth_summary_sync_empty');
  }
  const summary = pickString(data, ['Summary', 'summary']);
  if (!summary) {
    throw new Error('growth_summary_sync_empty');
  }
  return {
    summary,
    characteristics: parseGrowthCharacteristics(data.Characteristics ?? data.characteristics)
  };
}

export async function fetchGrowthChartContext(
  childExternalId: string,
  metric: GrowthMetric
): Promise<GrowthChartContext> {
  const res = await apiClient.get(
    `${SERVER_PATHS.childProfiles}/${encodeURIComponent(childExternalId)}/growth/chart-context`,
    { params: { Metric: metric, metric, fromMonths: 0, toMonths: 60 } }
  );
  const body = res.data as Record<string, unknown>;
  const data = body.Data as Record<string, unknown>;
  const curvesRaw = (data.PercentileCurves ?? {}) as Record<string, unknown>;
  const curvesContainer = (curvesRaw.Curves ?? null) as Record<string, unknown> | null;
  const percentileCurves: Record<string, WhoCurvePoint[]> = {};
  const curveKeys = ['P3', 'P15', 'P50', 'P85', 'P97'];
  if (curvesContainer && typeof curvesContainer === 'object') {
    for (const key of curveKeys) {
      percentileCurves[key] = parseCurvePoints(curvesContainer[key]);
    }
  }
  const recordsRaw = data.Records;
  const records = Array.isArray(recordsRaw)
    ? recordsRaw.map((row) => parseGrowthRecord(row as Record<string, unknown>))
    : [];
  const childRaw = data.ChildProfile as Record<string, unknown>;
  const summaryRaw = (data.LatestSummary ?? null) as Record<string, unknown> | null;
  return {
    childProfile: parseChildProfile(childRaw),
    metric: (pickString(data, ['Metric']) || metric) as GrowthMetric,
    records,
    percentileCurves,
    latestSummary: summaryRaw
      ? {
          weightPercentile: pickNumber(summaryRaw, ['WeightPercentile']),
          heightPercentile: pickNumber(summaryRaw, ['HeightPercentile']),
          bmiPercentile: pickNumber(summaryRaw, ['BmiPercentile']),
          hcPercentile: pickNumber(summaryRaw, ['HcPercentile']),
          interpretationBand: pickString(summaryRaw, ['InterpretationBand']) || null,
          characteristics: parseGrowthCharacteristics(summaryRaw.Characteristics ?? summaryRaw.characteristics)
        }
      : null,
    midParentalHeight: parseMidParentalHeight(data.MidParentalHeight ?? data.midParentalHeight)
  };
}
