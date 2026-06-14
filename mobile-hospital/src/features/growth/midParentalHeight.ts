export type MidParentalHeightSummary = {
  complete: boolean;
  motherHeightCm: number | null;
  fatherHeightCm: number | null;
  targetAdultHeightCm: number | null;
  targetRangeLowCm: number | null;
  targetRangeHighCm: number | null;
  expectedHeightAtAgeCm: number | null;
  expectedHeightAgeMonths: number | null;
  geneticTargetCurve: { ageMonths: number; value: number }[];
};

const SEX_ADJUSTMENT_CM = 13;
const TARGET_RANGE_CM = 8.5;

function pickOptionalNumber(row: Record<string, unknown>, keys: string[]): number | null {
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

export function parseMidParentalHeight(raw: unknown): MidParentalHeightSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const curveRaw = row.GeneticTargetCurve ?? row.geneticTargetCurve;
  const geneticTargetCurve = Array.isArray(curveRaw)
    ? curveRaw.map((pt) => {
        const item = pt as Record<string, unknown>;
        return {
          ageMonths: Number(item.AgeMonths ?? item.ageMonths ?? 0),
          value: Number(item.Value ?? item.value ?? 0)
        };
      })
    : [];

  return {
    complete: Boolean(row.Complete ?? row.complete),
    motherHeightCm: pickOptionalNumber(row, ['MotherHeightCm', 'motherHeightCm']),
    fatherHeightCm: pickOptionalNumber(row, ['FatherHeightCm', 'fatherHeightCm']),
    targetAdultHeightCm: pickOptionalNumber(row, ['TargetAdultHeightCm', 'targetAdultHeightCm']),
    targetRangeLowCm: pickOptionalNumber(row, ['TargetRangeLowCm', 'targetRangeLowCm']),
    targetRangeHighCm: pickOptionalNumber(row, ['TargetRangeHighCm', 'targetRangeHighCm']),
    expectedHeightAtAgeCm: pickOptionalNumber(row, ['ExpectedHeightAtAgeCm', 'expectedHeightAtAgeCm']),
    expectedHeightAgeMonths: pickOptionalNumber(row, ['ExpectedHeightAgeMonths', 'expectedHeightAgeMonths']),
    geneticTargetCurve
  };
}

export function computeMidParentalHeightClient(
  sex: string,
  motherHeightCm: number | null,
  fatherHeightCm: number | null
): Pick<
  MidParentalHeightSummary,
  'complete' | 'targetAdultHeightCm' | 'targetRangeLowCm' | 'targetRangeHighCm'
> {
  if (
    motherHeightCm == null ||
    fatherHeightCm == null ||
    motherHeightCm < 100 ||
    motherHeightCm > 250 ||
    fatherHeightCm < 100 ||
    fatherHeightCm > 250
  ) {
    return {
      complete: false,
      targetAdultHeightCm: null,
      targetRangeLowCm: null,
      targetRangeHighCm: null
    };
  }
  const normalized = sex.trim().toLowerCase();
  const sum = motherHeightCm + fatherHeightCm;
  const target =
    normalized === 'female' ? (sum - SEX_ADJUSTMENT_CM) / 2 : (sum + SEX_ADJUSTMENT_CM) / 2;
  const rounded = Math.round(target * 10) / 10;
  return {
    complete: true,
    targetAdultHeightCm: rounded,
    targetRangeLowCm: Math.round((rounded - TARGET_RANGE_CM) * 10) / 10,
    targetRangeHighCm: Math.round((rounded + TARGET_RANGE_CM) * 10) / 10
  };
}

export function resolveMidParentalHeight(
  fromChart: MidParentalHeightSummary | null,
  sex: string,
  motherHeightCm: number | null,
  fatherHeightCm: number | null
): MidParentalHeightSummary | null {
  if (fromChart?.complete) return fromChart;
  const fallback = computeMidParentalHeightClient(sex, motherHeightCm, fatherHeightCm);
  if (!fallback.complete) return fromChart;
  return {
    complete: true,
    motherHeightCm,
    fatherHeightCm,
    targetAdultHeightCm: fallback.targetAdultHeightCm,
    targetRangeLowCm: fallback.targetRangeLowCm,
    targetRangeHighCm: fallback.targetRangeHighCm,
    expectedHeightAtAgeCm: fromChart?.expectedHeightAtAgeCm ?? null,
    expectedHeightAgeMonths: fromChart?.expectedHeightAgeMonths ?? null,
    geneticTargetCurve: fromChart?.geneticTargetCurve ?? []
  };
}
