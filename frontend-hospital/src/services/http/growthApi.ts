import { apiClient } from './apiClient';
import { SERVER_PATHS } from './apiPaths';
import { pickString, pickNumber } from '../domain/hospital/shared/strings';

export type GrowthMetric = 'wfa' | 'lhfa' | 'bfa' | 'hcfa';

export interface ChildProfileRow {
  externalId: string;
  displayName: string;
  dateOfBirth: string;
  sex: string;
  bloodGroup?: string | null;
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
  } | null;
}

function parseChildProfile(row: Record<string, unknown>): ChildProfileRow {
  return {
    externalId: pickString(row, ['ExternalId']),
    displayName: pickString(row, ['DisplayName']),
    dateOfBirth: pickString(row, ['DateOfBirth']),
    sex: pickString(row, ['Sex']),
    bloodGroup: pickString(row, ['BloodGroup']) || null
  };
}

function parseGrowthRecord(row: Record<string, unknown>): GrowthRecordRow {
  return {
    externalId: pickString(row, ['ExternalId']),
    childProfileExternalId: pickString(row, ['ChildProfileExternalId']),
    recordedAt: pickString(row, ['RecordedAt']),
    ageMonthsAtRecording: pickNumber(row, ['AgeMonthsAtRecording']) ?? 0,
    heightCm: pickNumber(row, ['HeightCm']),
    weightKg: pickNumber(row, ['WeightKg']),
    headCircumferenceCm: pickNumber(row, ['HeadCircumferenceCm']),
    bmi: pickNumber(row, ['Bmi']),
    heightPercentile: pickNumber(row, ['HeightPercentile']),
    weightPercentile: pickNumber(row, ['WeightPercentile']),
    bmiPercentile: pickNumber(row, ['BmiPercentile']),
    hcPercentile: pickNumber(row, ['HcPercentile']),
    source: pickString(row, ['Source']) || 'manual',
    notes: pickString(row, ['Notes']) || null
  };
}

function parseCurvePoints(rows: unknown): WhoCurvePoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      ageMonths: pickNumber(item, ['AgeMonths']) ?? 0,
      value: pickNumber(item, ['Value']) ?? 0
    };
  });
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
}): Promise<ChildProfileRow> {
  const res = await apiClient.post(`${SERVER_PATHS.childProfiles}/save`, {
    ExternalId: payload.externalId ?? null,
    DisplayName: payload.displayName,
    DateOfBirth: payload.dateOfBirth,
    Sex: payload.sex,
    BloodGroup: payload.bloodGroup ?? null
  });
  const body = res.data as Record<string, unknown>;
  const data = body.Data as Record<string, unknown>;
  return parseChildProfile(data);
}

export async function saveGrowthRecord(payload: {
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

export async function fetchGrowthChartContext(
  childExternalId: string,
  metric: GrowthMetric
): Promise<GrowthChartContext> {
  const res = await apiClient.get(
    `${SERVER_PATHS.childProfiles}/${encodeURIComponent(childExternalId)}/growth/chart-context`,
    { params: { Metric: metric, FromMonths: 0, ToMonths: 60 } }
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
          interpretationBand: pickString(summaryRaw, ['InterpretationBand']) || null
        }
      : null
  };
}
