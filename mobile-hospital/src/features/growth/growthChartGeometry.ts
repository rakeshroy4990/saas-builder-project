import type { GrowthMetric } from '@/features/growth/growthApi';
import { formatBmiKgM2, type GrowthRecordRow } from '@/features/growth/growthHelpers';
import type { WhoCurvePoint } from '@/features/growth/growthChartContext';

export const CHART_WIDTH = 480;
export const CHART_HEIGHT = 220;

export type ChartGeometry = {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
  plotTop: number;
  plotBottom: number;
  curvePath: (key: string) => string;
  geneticPath: string;
  geneticTargetMarker: { x: number; y: number; value: number; age: number } | null;
  childLine: string;
  scaledPoints: { x: number; y: number; age: number; value: number; percentile: number | null }[];
  xTicks: { x: number; value: number; label: string }[];
  yTicks: { y: number; value: number; label: string }[];
};

function metricValue(record: GrowthRecordRow, metric: GrowthMetric): number | null {
  switch (metric) {
    case 'wfa':
      return record.weightKg ?? null;
    case 'lhfa':
      return record.heightCm ?? null;
    case 'bfa': {
      if (record.bmi != null && Number.isFinite(record.bmi)) return record.bmi;
      const bmiText = formatBmiKgM2(record);
      return bmiText != null ? Number(bmiText) : null;
    }
    case 'hcfa':
      return record.headCircumferenceCm ?? null;
    default:
      return null;
  }
}

function metricPercentile(record: GrowthRecordRow, metric: GrowthMetric): number | null {
  switch (metric) {
    case 'wfa':
      return record.weightPercentile ?? null;
    case 'lhfa':
      return record.heightPercentile ?? null;
    case 'bfa':
      return record.bmiPercentile ?? null;
    case 'hcfa':
      return record.hcPercentile ?? null;
    default:
      return null;
  }
}

function formatAxisNumber(value: number, metric: GrowthMetric): string {
  if (metric === 'bfa' || metric === 'wfa') return value.toFixed(1);
  return value.toFixed(0);
}

function buildAgeTicks(minAge: number, maxAge: number): number[] {
  const candidates = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60];
  const ticks = candidates.filter((age) => age >= minAge && age <= maxAge);
  if (!ticks.includes(minAge)) ticks.unshift(minAge);
  if (!ticks.includes(maxAge)) ticks.push(maxAge);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

function chartValueBounds(
  curveValues: number[],
  pointValues: number[]
): { min: number; max: number } {
  const all = [...curveValues, ...pointValues];
  if (!all.length) return { min: 0, max: 1 };
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const span = rawMax - rawMin || 1;
  const pad = span * 0.12;
  return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
}

function buildValueTicks(minVal: number, maxVal: number, metric: GrowthMetric): number[] {
  const span = maxVal - minVal || 1;
  const roughStep = span / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const step = Math.max(magnitude, Math.ceil(roughStep / magnitude) * magnitude);
  const start = Math.floor(minVal / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= maxVal + step * 0.001; v += step) {
    if (v >= minVal - step * 0.001 && v <= maxVal + step * 0.001) {
      ticks.push(Number(v.toFixed(metric === 'bfa' || metric === 'wfa' ? 1 : 0)));
    }
  }
  if (ticks.length < 2) {
    return [minVal, maxVal].map((v) => Number(formatAxisNumber(v, metric)));
  }
  return ticks;
}

export function yAxisTitleKey(metric: GrowthMetric): string {
  switch (metric) {
    case 'wfa':
      return 'growth.chart.valueKg';
    case 'lhfa':
      return 'growth.chart.valueCm';
    case 'bfa':
      return 'growth.chart.valueBmi';
    case 'hcfa':
      return 'growth.chart.valueHeadCm';
    default:
      return 'growth.chart.valueKg';
  }
}

export function computeChartGeometry(
  metric: GrowthMetric,
  records: GrowthRecordRow[],
  percentileCurves: Record<string, WhoCurvePoint[]>,
  geneticTargetCurve: WhoCurvePoint[],
  showGeneticLine: boolean,
  geneticTargetMarkerInput: { ageMonths: number; value: number } | null = null
): ChartGeometry {
  const width = CHART_WIDTH;
  const height = CHART_HEIGHT;
  const pad = { top: 16, right: 16, bottom: 40, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const plotBottom = height - pad.bottom;
  const plotTop = pad.top;

  const points: { age: number; value: number; percentile: number | null }[] = [];
  for (const record of records) {
    const value = metricValue(record, metric);
    if (value == null) continue;
    points.push({
      age: record.ageMonthsAtRecording,
      value,
      percentile: metricPercentile(record, metric)
    });
  }

  const curveValues: number[] = [];
  for (const curve of Object.values(percentileCurves)) {
    for (const pt of curve) curveValues.push(pt.value);
  }
  if (showGeneticLine) {
    for (const pt of geneticTargetCurve) curveValues.push(pt.value);
    if (geneticTargetMarkerInput) curveValues.push(geneticTargetMarkerInput.value);
  }
  for (const pt of points) curveValues.push(pt.value);

  const ages = [
    ...points.map((p) => p.age),
    ...Object.values(percentileCurves).flat().map((p) => p.ageMonths),
    ...(showGeneticLine ? geneticTargetCurve.map((p) => p.ageMonths) : []),
    ...(showGeneticLine && geneticTargetMarkerInput ? [geneticTargetMarkerInput.ageMonths] : []),
    0,
    60
  ];
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages, 1);
  const bounds = chartValueBounds(curveValues, points.map((p) => p.value));
  const minVal = bounds.min;
  const maxVal = bounds.max;

  const scaleX = (age: number) => pad.left + ((age - minAge) / (maxAge - minAge || 1)) * plotW;
  const scaleY = (value: number) => pad.top + plotH - ((value - minVal) / (maxVal - minVal || 1)) * plotH;

  const scaledPoints = points.map((p) => ({
    ...p,
    x: scaleX(p.age),
    y: scaleY(p.value)
  }));

  function curvePath(key: string): string {
    const curve = percentileCurves[key] ?? [];
    if (!curve.length) return '';
    return curve
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(pt.ageMonths).toFixed(1)} ${scaleY(pt.value).toFixed(1)}`)
      .join(' ');
  }

  const geneticPath =
    showGeneticLine && geneticTargetCurve.length
      ? geneticTargetCurve
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(pt.ageMonths).toFixed(1)} ${scaleY(pt.value).toFixed(1)}`)
          .join(' ')
      : '';

  const geneticTargetMarker =
    showGeneticLine && geneticTargetMarkerInput
      ? {
          x: scaleX(geneticTargetMarkerInput.ageMonths),
          y: scaleY(geneticTargetMarkerInput.value),
          value: geneticTargetMarkerInput.value,
          age: geneticTargetMarkerInput.ageMonths
        }
      : null;

  const childLine = scaledPoints.length
    ? scaledPoints.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
    : '';

  const xTicks = buildAgeTicks(minAge, maxAge).map((value) => ({
    x: scaleX(value),
    value,
    label: String(Math.round(value))
  }));

  const yTicks = buildValueTicks(minVal, maxVal, metric).map((value) => ({
    y: scaleY(value),
    value,
    label: formatAxisNumber(value, metric)
  }));

  return {
    width,
    height,
    pad,
    plotTop,
    plotBottom,
    curvePath,
    geneticPath,
    geneticTargetMarker,
    childLine,
    scaledPoints,
    xTicks,
    yTicks
  };
}
