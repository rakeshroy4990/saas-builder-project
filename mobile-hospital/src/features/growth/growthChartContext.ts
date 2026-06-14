import type { GrowthMetric } from '@/features/growth/growthApi';
import { parseMidParentalHeight, type MidParentalHeightSummary } from '@/features/growth/midParentalHeight';
import { parseGrowthCharacteristics, type GrowthCharacteristics } from '@/features/growth/growthCharacteristics';
import { parseGrowthRecord, type GrowthRecordRow } from '@/features/growth/growthHelpers';

export type WhoCurvePoint = { ageMonths: number; value: number };

export type ChildProfileRow = {
  externalId: string;
  displayName: string;
  dateOfBirth: string;
  sex: string;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
};

export type GrowthChartContext = {
  childProfile: ChildProfileRow;
  metric: GrowthMetric;
  records: GrowthRecordRow[];
  percentileCurves: Record<string, WhoCurvePoint[]>;
  latestSummary: {
    weightPercentile: number | null;
    heightPercentile: number | null;
    bmiPercentile: number | null;
    hcPercentile: number | null;
    characteristics: GrowthCharacteristics | null;
  } | null;
  midParentalHeight: MidParentalHeightSummary | null;
};

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function parseChildProfile(row: Record<string, unknown>): ChildProfileRow {
  return {
    externalId: pickString(row, ['ExternalId', 'externalId']),
    displayName: pickString(row, ['DisplayName', 'displayName']),
    dateOfBirth: pickString(row, ['DateOfBirth', 'dateOfBirth']),
    sex: pickString(row, ['Sex', 'sex']),
    motherHeightCm: pickNumber(row, ['MotherHeightCm', 'motherHeightCm']),
    fatherHeightCm: pickNumber(row, ['FatherHeightCm', 'fatherHeightCm'])
  };
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

export function parseGrowthChartContext(data: Record<string, unknown>, metric: GrowthMetric): GrowthChartContext {
  const curvesRaw = (data.PercentileCurves ?? data.percentileCurves ?? {}) as Record<string, unknown>;
  const curvesContainer = (curvesRaw.Curves ?? curvesRaw.curves ?? null) as Record<string, unknown> | null;
  const percentileCurves: Record<string, WhoCurvePoint[]> = {};
  const curveKeys = ['P3', 'P15', 'P50', 'P85', 'P97'];
  if (curvesContainer && typeof curvesContainer === 'object') {
    for (const key of curveKeys) {
      percentileCurves[key] = parseCurvePoints(curvesContainer[key]);
    }
  }

  const recordsRaw = data.Records ?? data.records;
  const records = Array.isArray(recordsRaw)
    ? recordsRaw.map((row) => parseGrowthRecord(row as Record<string, unknown>))
    : [];

  const childRaw = (data.ChildProfile ?? data.childProfile ?? {}) as Record<string, unknown>;
  const summaryRaw = (data.LatestSummary ?? data.latestSummary ?? null) as Record<string, unknown> | null;

  return {
    childProfile: parseChildProfile(childRaw),
    metric: (pickString(data, ['Metric', 'metric']) || metric) as GrowthMetric,
    records,
    percentileCurves,
    latestSummary: summaryRaw
      ? {
          weightPercentile: pickNumber(summaryRaw, ['WeightPercentile', 'weightPercentile']),
          heightPercentile: pickNumber(summaryRaw, ['HeightPercentile', 'heightPercentile']),
          bmiPercentile: pickNumber(summaryRaw, ['BmiPercentile', 'bmiPercentile']),
          hcPercentile: pickNumber(summaryRaw, ['HcPercentile', 'hcPercentile']),
          characteristics: parseGrowthCharacteristics(
            summaryRaw.Characteristics ?? summaryRaw.characteristics
          )
        }
      : null,
    midParentalHeight: parseMidParentalHeight(data.MidParentalHeight ?? data.midParentalHeight)
  };
}

export function mergeChildProfileRow(
  children: Record<string, unknown>[],
  updated: ChildProfileRow
): Record<string, unknown>[] {
  if (!updated.externalId) return children;
  const index = children.findIndex((row) => String(row.ExternalId ?? '') === updated.externalId);
  const patch = {
    ExternalId: updated.externalId,
    DisplayName: updated.displayName,
    DateOfBirth: updated.dateOfBirth,
    Sex: updated.sex,
    MotherHeightCm: updated.motherHeightCm,
    FatherHeightCm: updated.fatherHeightCm
  };
  if (index < 0) return [...children, patch];
  const next = [...children];
  next[index] = { ...next[index], ...patch };
  return next;
}

export function childProfileFromRow(row: Record<string, unknown> | null): ChildProfileRow | null {
  if (!row) return null;
  const parsed = parseChildProfile(row);
  return parsed.externalId ? parsed : null;
}

export { parseChildProfile as parseChildProfileRow };
