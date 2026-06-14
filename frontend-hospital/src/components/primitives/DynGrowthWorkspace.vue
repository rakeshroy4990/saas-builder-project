<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import { useActionEngine } from '../../composables/useActionEngine';
import { hospitalPages } from '../../configs/hospital/pages';
import type { GrowthMetric, GrowthRecordRow, WhoCurvePoint, ChildProfileRow } from '../../services/http/growthApi';
import {
  fetchGrowthHistorySummary,
  formatBmiKgM2,
  isTallLeanGrowthPattern,
  parseGrowthRecord,
  parseChildProfileRow,
  coalesceParentHeights,
  resolveGrowthCharacteristics,
  type GrowthCharacteristics,
  type GrowthChartContext
} from '../../services/http/growthApi';
import { resolveMidParentalHeight } from '../../services/domain/hospital/growth/midParentalHeight';
import { formatAgeAtRecordingLabel } from '../../services/http/growthAge';
import { resolveStyle } from '../../core/engine/StyleResolver';

const dashboardPageConfig =
  hospitalPages.find((page) => page.pageId === 'dashboard') ?? hospitalPages[0]!;

const appStore = useAppStore(pinia);
const engine = useActionEngine(dashboardPageConfig);
const { t, locale } = useI18n();

const inlinePrimaryButtonClass = resolveStyle({ styleTemplate: 'hosp.button.inlinePrimary' });
const inlineSecondaryButtonClass = resolveStyle({ styleTemplate: 'hosp.button.inlineSecondary' });
const ws = (token: string): string => resolveStyle({ styleTemplate: `hosp.workspace.${token}` });
const metricGuideOpen = ref(false);
const manualEntryOpen = ref(false);
const manualEntryRef = ref<HTMLElement | null>(null);
const historySummaries = ref<Record<string, string>>({});
const historyCharacteristics = ref<Record<string, GrowthCharacteristics>>({});
const summaryInflightIds = ref<Record<string, boolean>>({});
const CHART_WIDTH = 480;
const CHART_HEIGHT = 220;

const metrics: { id: GrowthMetric; labelKey: string; guideKey: string }[] = [
  { id: 'wfa', labelKey: 'growth.metric.weight', guideKey: 'growth.metricGuide.weight' },
  { id: 'lhfa', labelKey: 'growth.metric.height', guideKey: 'growth.metricGuide.height' },
  { id: 'bfa', labelKey: 'growth.metric.bmi', guideKey: 'growth.metricGuide.bmi' },
  { id: 'hcfa', labelKey: 'growth.metric.headCirc', guideKey: 'growth.metricGuide.headCirc' }
];

const session = computed(() => {
  void appStore.dataRevision;
  const raw = (appStore.getData('hospital', 'GrowthSession') ?? {}) as Record<string, unknown>;
  return {
    loading: Boolean(raw.loading),
    children: Array.isArray(raw.children) ? raw.children : [],
    selectedChildId: String(raw.selectedChildId ?? ''),
    metric: (String(raw.metric ?? 'wfa') as GrowthMetric),
    chart: raw.chart as Record<string, unknown> | null,
    showAddChild: Boolean(raw.showAddChild),
    editingChildId: String(raw.editingChildId ?? ''),
    newChildName: String(raw.newChildName ?? ''),
    newChildDob: String(raw.newChildDob ?? ''),
    newChildSex: String(raw.newChildSex ?? 'male'),
    newMotherHeightCm: String(raw.newMotherHeightCm ?? ''),
    newFatherHeightCm: String(raw.newFatherHeightCm ?? ''),
    entryHeightCm: String(raw.entryHeightCm ?? ''),
    entryWeightKg: String(raw.entryWeightKg ?? ''),
    entryHcCm: String(raw.entryHcCm ?? ''),
    entryRecordedDate: String(raw.entryRecordedDate ?? ''),
    editingRecordId: String(raw.editingRecordId ?? '')
  };
});

const chartRecords = computed((): GrowthRecordRow[] => {
  const records = session.value.chart?.records;
  if (!Array.isArray(records)) return [];
  return records.map((row) => parseGrowthRecord(row as Record<string, unknown>));
});

const historyRecordsDesc = computed((): GrowthRecordRow[] =>
  [...chartRecords.value].sort(
    (left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt)
  )
);

/** Stable signature so unrelated Pinia updates do not re-queue the same summaries. */
const historyRecordsSignature = computed(() =>
  historyRecordsDesc.value.map((row) => row.externalId).filter(Boolean).join('|')
);

const latestChartRecord = computed((): GrowthRecordRow | null => historyRecordsDesc.value[0] ?? null);

const latestGrowthCharacteristics = computed((): GrowthCharacteristics | null => {
  const record = latestChartRecord.value;
  if (!record) return null;
  return resolveRecordCharacteristics(record, session.value.chart?.latestSummary?.characteristics ?? null);
});

function resolveRecordCharacteristics(
  record: GrowthRecordRow,
  chartCharacteristics?: GrowthCharacteristics | null
): GrowthCharacteristics {
  const sex = selectedChild.value?.sex ?? null;
  const cached = historyCharacteristics.value[record.externalId];
  return resolveGrowthCharacteristics(sex, record, t, cached ?? chartCharacteristics ?? null);
}

const selectedChild = computed((): ChildProfileRow | null => {
  const childId = session.value.selectedChildId;
  if (!childId) return null;
  const fromList =
    session.value.children
      .map((row) => parseChildProfileRow(row))
      .find((child) => child?.externalId === childId) ?? null;
  const chart = session.value.chart as GrowthChartContext | null;
  const fromChart = chart?.childProfile ? parseChildProfileRow(chart.childProfile) : null;
  const mph = chart?.midParentalHeight ?? null;
  if (!fromList && !fromChart) return null;
  if (!fromChart) return fromList ? { ...fromList, ...coalesceParentHeights(fromList, mph) } : null;
  if (!fromList) return { ...fromChart, ...coalesceParentHeights(fromChart, mph) };
  return {
    ...fromList,
    ...fromChart,
    ...coalesceParentHeights(
      {
        motherHeightCm: fromChart.motherHeightCm ?? fromList.motherHeightCm ?? null,
        fatherHeightCm: fromChart.fatherHeightCm ?? fromList.fatherHeightCm ?? null
      },
      mph
    )
  };
});

function historyAgeLabel(record: GrowthRecordRow): string {
  const dob = selectedChild.value?.dateOfBirth ?? '';
  if (!dob) return '';
  return formatAgeAtRecordingLabel(dob, record.recordedAt, t) ?? '';
}

const todayDateValue = computed(() => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
});

const percentileCurves = computed((): Record<string, WhoCurvePoint[]> => {
  const curves = session.value.chart?.percentileCurves as Record<string, WhoCurvePoint[]> | undefined;
  return curves ?? {};
});

const midParentalHeight = computed(() => {
  const chart = session.value.chart as GrowthChartContext | null;
  const child = selectedChild.value;
  const heights = coalesceParentHeights(child, chart?.midParentalHeight ?? null);
  return resolveMidParentalHeight(
    chart?.midParentalHeight ?? null,
    child?.sex ?? 'male',
    heights.motherHeightCm,
    heights.fatherHeightCm
  );
});

const geneticTargetCurve = computed((): WhoCurvePoint[] => midParentalHeight.value?.geneticTargetCurve ?? []);

const geneticHeightComparison = computed((): 'above' | 'below' | 'on_track' | null => {
  if (session.value.metric !== 'lhfa' || !midParentalHeight.value?.complete) return null;
  const expected = midParentalHeight.value.expectedHeightAtAgeCm;
  const latestHeight = latestChartRecord.value?.heightCm ?? null;
  if (expected == null || latestHeight == null) return null;
  const delta = latestHeight - expected;
  if (Math.abs(delta) <= 1.5) return 'on_track';
  return delta > 0 ? 'above' : 'below';
});

function metricValue(record: GrowthRecordRow): number | null {
  switch (session.value.metric) {
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

function metricPercentile(record: GrowthRecordRow): number | null {
  switch (session.value.metric) {
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
  if (metric === 'bfa' || metric === 'wfa') {
    return value.toFixed(1);
  }
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
  metric: GrowthMetric,
  curveValues: number[],
  pointValues: number[]
): { min: number; max: number } {
  const all = [...curveValues, ...pointValues];
  if (!all.length) return { min: 0, max: 1 };
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const span = rawMax - rawMin || 1;
  const pad = span * 0.12;
  return {
    min: Math.max(0, rawMin - pad),
    max: rawMax + pad
  };
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

const yAxisTitleKey = computed((): string => {
  switch (session.value.metric) {
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
});

const chartGeometry = computed(() => {
  const width = CHART_WIDTH;
  const height = CHART_HEIGHT;
  const pad = { top: 16, right: 16, bottom: 40, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const metric = session.value.metric;
  const plotBottom = height - pad.bottom;
  const plotTop = pad.top;

  const points: { x: number; y: number; age: number; value: number; percentile: number | null }[] = [];
  for (const record of chartRecords.value) {
    const value = metricValue(record);
    if (value == null) continue;
    points.push({
      x: 0,
      y: 0,
      age: record.ageMonthsAtRecording,
      value,
      percentile: metricPercentile(record)
    });
  }

  const curveValues: number[] = [];
  for (const curve of Object.values(percentileCurves.value)) {
    for (const pt of curve) curveValues.push(pt.value);
  }
  for (const pt of geneticTargetCurve.value) curveValues.push(pt.value);
  const mphBounds = midParentalHeight.value;
  if (session.value.metric === 'lhfa' && mphBounds?.expectedHeightAtAgeCm != null) {
    curveValues.push(mphBounds.expectedHeightAtAgeCm);
  }
  for (const pt of points) curveValues.push(pt.value);

  const ages = [
    ...points.map((p) => p.age),
    ...Object.values(percentileCurves.value).flat().map((p) => p.ageMonths),
    ...geneticTargetCurve.value.map((p) => p.ageMonths),
    ...(session.value.metric === 'lhfa' && mphBounds?.expectedHeightAgeMonths != null
      ? [mphBounds.expectedHeightAgeMonths]
      : []),
    0,
    60
  ];
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages, 1);
  const pointValues = points.map((p) => p.value);
  const bounds = chartValueBounds(metric, curveValues, pointValues);
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
    const curve = percentileCurves.value[key] ?? [];
    if (!curve.length) return '';
    return curve
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(pt.ageMonths).toFixed(1)} ${scaleY(pt.value).toFixed(1)}`)
      .join(' ');
  }

  const geneticPath = geneticTargetCurve.value.length
    ? geneticTargetCurve.value
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${scaleX(pt.ageMonths).toFixed(1)} ${scaleY(pt.value).toFixed(1)}`)
        .join(' ')
    : '';

  const mph = midParentalHeight.value;
  const geneticTargetMarker =
    session.value.metric === 'lhfa' &&
    mph?.complete &&
    mph.expectedHeightAtAgeCm != null &&
    mph.expectedHeightAgeMonths != null
      ? {
          x: scaleX(mph.expectedHeightAgeMonths),
          y: scaleY(mph.expectedHeightAtAgeCm),
          value: mph.expectedHeightAtAgeCm,
          age: mph.expectedHeightAgeMonths
        }
      : null;

  const childLine = scaledPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const xTicks = buildAgeTicks(minAge, maxAge).map((age) => ({
    value: age,
    x: scaleX(age),
    label: String(Math.round(age))
  }));

  const yTicks = buildValueTicks(minVal, maxVal, metric).map((value) => ({
    value,
    y: scaleY(value),
    label: formatAxisNumber(value, metric)
  }));

  return {
    width,
    height,
    pad,
    plotBottom,
    plotTop,
    scaledPoints,
    curvePath,
    geneticPath,
    geneticTargetMarker,
    childLine,
    minAge,
    maxAge,
    minVal,
    maxVal,
    xTicks,
    yTicks
  };
});

function percentileBadgeClass(percentile: number | null): string {
  if (percentile == null) return 'bg-slate-100 text-slate-700';
  if (percentile < 3 || percentile > 97) return 'bg-red-100 text-red-800';
  if (percentile < 15 || percentile > 85) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

function formatPercentileDisplay(percentile: number | null): string {
  if (percentile == null) return '—';
  return `${Math.round(percentile)}%`;
}

function historyPercentileBadgeClass(
  percentile: number | null,
  _kind: 'weight' | 'height' | 'bmi'
): string {
  return percentileBadgeClass(percentile);
}

async function run(actionId: string, data: Record<string, unknown> = {}): Promise<void> {
  await engine.execute({ actionId, data });
}

function onField(field: string, event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  void run('patch-growth-session', { [field]: value });
}

async function startEditRecord(record: GrowthRecordRow): Promise<void> {
  manualEntryOpen.value = true;
  await run('start-edit-growth-record', {
    externalId: record.externalId,
    recordedAt: record.recordedAt,
    heightCm: record.heightCm,
    weightKg: record.weightKg,
    headCircumferenceCm: record.headCircumferenceCm
  });
  await nextTick();
  manualEntryRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function applyHistorySummary(
  recordId: string,
  text: string,
  characteristics?: GrowthCharacteristics | null
): void {
  const trimmed = text.trim();
  if (recordId && trimmed) {
    historySummaries.value = { ...historySummaries.value, [recordId]: trimmed };
  }
  if (recordId && characteristics?.phrase) {
    historyCharacteristics.value = { ...historyCharacteristics.value, [recordId]: characteristics };
  }
}

function setSummaryInflight(recordId: string, active: boolean): void {
  if (!recordId) return;
  const next = { ...summaryInflightIds.value };
  if (active) {
    next[recordId] = true;
  } else {
    delete next[recordId];
  }
  summaryInflightIds.value = next;
}

function queueHistorySummaries(records: GrowthRecordRow[], childId: string): void {
  const fetchChildId = childId.trim();
  if (!fetchChildId) return;

  for (const record of records) {
    const id = record.externalId.trim();
    if (!id || historySummaries.value[id] || summaryInflightIds.value[id]) {
      continue;
    }
    setSummaryInflight(id, true);
    let accumulated = '';
    void fetchGrowthHistorySummary(fetchChildId, record, {
      onDelta: (chunk) => {
        if (fetchChildId !== session.value.selectedChildId.trim()) return;
        accumulated += chunk;
        applyHistorySummary(id, accumulated);
      },
      onComplete: (summary, characteristics) => {
        if (fetchChildId !== session.value.selectedChildId.trim()) return;
        applyHistorySummary(id, summary || accumulated, characteristics);
      }
    }, selectedChild.value?.sex ?? null)
      .then((result) => {
        if (fetchChildId !== session.value.selectedChildId.trim()) return;
        applyHistorySummary(id, result.summary, result.characteristics);
      })
      .catch(() => {
        /* silent — summaries are optional enrichment */
      })
      .finally(() => {
        setSummaryInflight(id, false);
      });
  }
}

watch(
  locale,
  () => {
    historySummaries.value = {};
    historyCharacteristics.value = {};
    summaryInflightIds.value = {};
    const childId = session.value.selectedChildId.trim();
    if (childId && historyRecordsDesc.value.length) {
      queueHistorySummaries(historyRecordsDesc.value, childId);
    }
  }
);

watch(
  [historyRecordsSignature, () => session.value.selectedChildId],
  ([, childId], prev) => {
    const normalizedChildId = childId.trim();
    if (!normalizedChildId) {
      historySummaries.value = {};
      historyCharacteristics.value = {};
      summaryInflightIds.value = {};
      return;
    }
    const prevChildId = String(prev?.[1] ?? '').trim();
    if (prevChildId && prevChildId !== normalizedChildId) {
      historySummaries.value = {};
      historyCharacteristics.value = {};
      summaryInflightIds.value = {};
    }
    if (!historyRecordsDesc.value.length) return;
    queueHistorySummaries(historyRecordsDesc.value, normalizedChildId);
  },
  { immediate: true }
);
</script>

<template>
  <div :class="ws('root')">
    <div>
      <h2 :class="ws('pageTitle')">{{ t('growth.title') }}</h2>
      <p :class="ws('pageIntro')">{{ t('growth.intro') }}</p>
      <div :class="ws('recordingCadence')" role="note">
        <p :class="ws('recordingCadenceTitle')">{{ t('growth.recordingCadenceTitle') }}</p>
        <p :class="ws('recordingCadenceBody')">{{ t('growth.recordingCadenceBody') }}</p>
      </div>
      <p :class="ws('disclaimer')">{{ t('growth.disclaimer') }}</p>
    </div>

    <div :class="ws('toolbar')">
      <div>
        <label for="growth-child-select" :class="ws('fieldLabel')">
          {{ t('growth.selectChild') }}
        </label>
        <select
          id="growth-child-select"
          :class="ws('select')"
          :value="session.selectedChildId"
          @change="run('select-growth-child', { childId: ($event.target as HTMLSelectElement).value })"
        >
          <option value="" disabled>{{ t('growth.selectChildPlaceholder') }}</option>
          <option v-for="child in session.children" :key="child.externalId" :value="child.externalId">
            {{ child.displayName }}
          </option>
        </select>
      </div>
      <button
        type="button"
        :class="inlineSecondaryButtonClass"
        @click="run('start-add-child-form')"
      >
        {{ t('growth.addChild') }}
      </button>
      <button
        v-if="session.selectedChildId"
        type="button"
        :class="inlineSecondaryButtonClass"
        @click="run('start-edit-child-profile')"
      >
        {{ t('growth.editChild') }}
      </button>
    </div>

    <div v-if="session.showAddChild" :class="[ws('panelMuted'), ws('panelStack')]">
      <h3 :class="ws('sectionTitle')">
        {{ t(session.editingChildId ? 'growth.editChildTitle' : 'growth.addChildTitle') }}
      </h3>
      <div :class="ws('formGrid')">
        <input :class="ws('input')" :placeholder="t('growth.childName')" :value="session.newChildName" @input="onField('newChildName', $event)" />
        <input type="date" :class="ws('input')" :value="session.newChildDob" @input="onField('newChildDob', $event)" />
        <select :class="ws('input')" :value="session.newChildSex" @change="onField('newChildSex', $event)">
          <option value="male">{{ t('growth.sex.male') }}</option>
          <option value="female">{{ t('growth.sex.female') }}</option>
        </select>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-600">{{ t('growth.motherHeightCm') }}</span>
          <input
            :class="ws('input')"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            :placeholder="t('growth.motherHeightCm')"
            :value="session.newMotherHeightCm"
            @input="onField('newMotherHeightCm', $event)"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs font-medium text-slate-600">{{ t('growth.fatherHeightCm') }}</span>
          <input
            :class="ws('input')"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            :placeholder="t('growth.fatherHeightCm')"
            :value="session.newFatherHeightCm"
            @input="onField('newFatherHeightCm', $event)"
          />
        </label>
      </div>
      <p class="text-xs leading-relaxed text-slate-600">{{ t('growth.parentHeightHint') }}</p>
      <div :class="ws('formActions')">
        <button type="button" :class="inlinePrimaryButtonClass" @click="run('save-new-child-profile')">
          {{ t(session.editingChildId ? 'growth.updateChild' : 'growth.saveChild') }}
        </button>
        <button type="button" :class="inlineSecondaryButtonClass" @click="run('cancel-child-form')">
          {{ t('growth.cancelEdit') }}
        </button>
      </div>
    </div>

    <div v-if="session.selectedChildId" :class="ws('stack')">
      <div :class="ws('collapsible')">
        <button
          type="button"
          :class="ws('collapsibleTrigger')"
          :aria-expanded="metricGuideOpen"
          @click="metricGuideOpen = !metricGuideOpen"
        >
          <span>{{ t('growth.metricGuide.title') }}</span>
          <span class="shrink-0 text-xs text-slate-500" aria-hidden="true">{{ metricGuideOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="metricGuideOpen" :class="ws('collapsibleBody')">
          <ul :class="ws('collapsibleList')">
            <li
              v-for="metric in metrics"
              :key="metric.id"
              :class="[ws('collapsibleListItem'), session.metric === metric.id ? ws('collapsibleListItemActive') : '']"
            >
              <span class="shrink-0 font-medium text-slate-800">{{ t(metric.labelKey) }}</span>
              <span class="hidden text-slate-400 sm:inline">—</span>
              <span>{{ t(metric.guideKey) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="metric in metrics"
          :key="metric.id"
          type="button"
          :class="[ws('metricPill'), session.metric === metric.id ? ws('metricPillActive') : ws('metricPillInactive')]"
          @click="run('set-growth-metric', { metric: metric.id })"
        >
          {{ t(metric.labelKey) }}
        </button>
      </div>

      <div v-if="session.loading" :class="ws('loadingText')">{{ t('growth.loading') }}</div>

      <div v-else-if="session.selectedChildId && midParentalHeight?.complete" :class="[ws('callout'), 'mb-3', 'border-2', 'border-teal-500', 'bg-teal-50']">
        <p :class="[ws('calloutTitle'), 'text-teal-900']">{{ t('growth.midParentalHeight.title') }}</p>
        <p class="mt-2 text-base font-semibold text-teal-950">
          {{ t('growth.midParentalHeight.targetAdult', {
            height: midParentalHeight.targetAdultHeightCm,
            low: midParentalHeight.targetRangeLowCm,
            high: midParentalHeight.targetRangeHighCm
          }) }}
        </p>
        <p
          v-if="midParentalHeight.expectedHeightAtAgeCm != null"
          class="mt-2 rounded-lg bg-white/80 px-3 py-2 text-sm font-medium text-teal-900 ring-1 ring-teal-200"
        >
          {{ t('growth.midParentalHeight.expectedAtAge', {
            height: midParentalHeight.expectedHeightAtAgeCm,
            months: Math.round(midParentalHeight.expectedHeightAgeMonths ?? 0)
          }) }}
        </p>
        <p
          v-if="geneticHeightComparison === 'above'"
          class="mt-2 text-sm font-medium text-teal-800"
        >
          {{ t('growth.midParentalHeight.latestAboveGenetic') }}
        </p>
        <p
          v-else-if="geneticHeightComparison === 'below'"
          class="mt-2 text-sm font-medium text-teal-800"
        >
          {{ t('growth.midParentalHeight.latestBelowGenetic') }}
        </p>
        <p
          v-else-if="geneticHeightComparison === 'on_track'"
          class="mt-2 text-sm font-medium text-teal-800"
        >
          {{ t('growth.midParentalHeight.latestOnGenetic') }}
        </p>
        <p class="mt-2 text-xs leading-relaxed text-teal-800/90">{{ t('growth.midParentalHeight.note') }}</p>
        <p
          v-if="session.metric !== 'lhfa'"
          class="mt-2 text-xs font-semibold text-teal-900"
        >
          {{ t('growth.midParentalHeight.viewHeightChart') }}
        </p>
      </div>

      <div v-else-if="session.selectedChildId" :class="[ws('callout'), 'mb-3']">
        <p :class="ws('calloutTitle')">{{ t('growth.midParentalHeight.title') }}</p>
        <p class="mt-2 text-sm text-slate-600">{{ t('growth.midParentalHeight.incomplete') }}</p>
      </div>

      <div v-if="!session.loading" :class="ws('chartCard')">
        <svg
          :viewBox="`0 0 ${chartGeometry.width} ${chartGeometry.height}`"
          :class="ws('chartSvg')"
        >
          <g v-for="tick in chartGeometry.yTicks" :key="`y-grid-${tick.value}`">
            <line
              :x1="chartGeometry.pad.left"
              :y1="tick.y"
              :x2="chartGeometry.width - chartGeometry.pad.right"
              :y2="tick.y"
              stroke="#f1f5f9"
            />
          </g>
          <g v-for="tick in chartGeometry.xTicks" :key="`x-grid-${tick.value}`">
            <line
              :x1="tick.x"
              :y1="chartGeometry.plotTop"
              :x2="tick.x"
              :y2="chartGeometry.plotBottom"
              stroke="#f1f5f9"
            />
          </g>
          <line
            :x1="chartGeometry.pad.left"
            :y1="chartGeometry.plotBottom"
            :x2="chartGeometry.width - chartGeometry.pad.right"
            :y2="chartGeometry.plotBottom"
            stroke="#cbd5e1"
          />
          <line
            :x1="chartGeometry.pad.left"
            :y1="chartGeometry.plotTop"
            :x2="chartGeometry.pad.left"
            :y2="chartGeometry.plotBottom"
            stroke="#cbd5e1"
          />
          <g v-for="tick in chartGeometry.yTicks" :key="`y-tick-${tick.value}`">
            <text
              :x="chartGeometry.pad.left - 8"
              :y="tick.y + 4"
              text-anchor="end"
              font-size="10"
              fill="#64748b"
            >
              {{ tick.label }}
            </text>
          </g>
          <g v-for="tick in chartGeometry.xTicks" :key="`x-tick-${tick.value}`">
            <text
              :x="tick.x"
              :y="chartGeometry.plotBottom + 16"
              text-anchor="middle"
              font-size="10"
              fill="#64748b"
            >
              {{ tick.label }}
            </text>
          </g>
          <text
            :x="(chartGeometry.pad.left + chartGeometry.width - chartGeometry.pad.right) / 2"
            :y="chartGeometry.height - 10"
            text-anchor="middle"
            font-size="11"
            font-weight="600"
            fill="#475569"
          >
            {{ t('growth.chart.ageMonths') }}
          </text>
          <text
            :x="14"
            :y="(chartGeometry.plotTop + chartGeometry.plotBottom) / 2"
            text-anchor="middle"
            font-size="11"
            font-weight="600"
            fill="#475569"
            :transform="`rotate(-90, 14, ${(chartGeometry.plotTop + chartGeometry.plotBottom) / 2})`"
          >
            {{ t(yAxisTitleKey) }}
          </text>
          <path v-if="chartGeometry.curvePath('P3')" :d="chartGeometry.curvePath('P3')" fill="none" stroke="#fca5a5" stroke-width="1" stroke-dasharray="4 3" />
          <path v-if="chartGeometry.curvePath('P50')" :d="chartGeometry.curvePath('P50')" fill="none" stroke="#94a3b8" stroke-width="1.5" />
          <path v-if="chartGeometry.curvePath('P97')" :d="chartGeometry.curvePath('P97')" fill="none" stroke="#fdba74" stroke-width="1" stroke-dasharray="4 3" />
          <path
            v-if="session.metric === 'lhfa' && chartGeometry.geneticPath"
            :d="chartGeometry.geneticPath"
            fill="none"
            stroke="#0d9488"
            stroke-width="2"
            stroke-dasharray="6 4"
          />
          <g v-if="chartGeometry.geneticTargetMarker">
            <circle
              :cx="chartGeometry.geneticTargetMarker.x"
              :cy="chartGeometry.geneticTargetMarker.y"
              r="9"
              fill="none"
              stroke="#0d9488"
              stroke-width="2"
              opacity="0.35"
            />
            <circle
              :cx="chartGeometry.geneticTargetMarker.x"
              :cy="chartGeometry.geneticTargetMarker.y"
              r="5"
              fill="#0d9488"
              stroke="#ffffff"
              stroke-width="2"
            />
          </g>
          <path v-if="chartGeometry.childLine" :d="chartGeometry.childLine" fill="none" stroke="#2563eb" stroke-width="2.5" />
          <circle
            v-for="(pt, idx) in chartGeometry.scaledPoints"
            :key="idx"
            :cx="pt.x"
            :cy="pt.y"
            r="4"
            fill="#2563eb"
          />
        </svg>
        <div :class="ws('chartLegend')">
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-0.5 w-4 rounded bg-blue-600" />
            {{ t('growth.chart.legendChild') }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-0.5 w-4 rounded bg-slate-400" />
            {{ t('growth.chart.legendP50') }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-0.5 w-4 rounded border-b border-dashed border-rose-300" />
            {{ t('growth.chart.legendP3') }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block h-0.5 w-4 rounded border-b border-dashed border-orange-300" />
            {{ t('growth.chart.legendP97') }}
          </span>
          <span
            v-if="session.metric === 'lhfa' && midParentalHeight?.complete"
            class="inline-flex items-center gap-1.5"
          >
            <span class="inline-block h-0.5 w-4 rounded border-b border-dashed border-teal-600" />
            {{ t('growth.chart.legendGeneticTarget') }}
          </span>
        </div>
        <div
          v-if="session.metric === 'bfa' && latestChartRecord"
          :class="ws('callout')"
        >
          <p :class="ws('calloutTitle')">{{ t('growth.chart.bmiContextTitle') }}</p>
          <p
            v-if="latestGrowthCharacteristics?.phrase"
            class="mt-1 text-sm font-medium text-slate-800"
          >
            {{ t('growth.profilePhrase', { phrase: latestGrowthCharacteristics.phrase }) }}
          </p>
          <div
            v-if="latestGrowthCharacteristics?.labels?.length"
            class="mt-2 flex flex-wrap gap-1.5"
          >
            <span
              v-for="label in latestGrowthCharacteristics.labels"
              :key="label"
              class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {{ label }}
            </span>
          </div>
          <div :class="[ws('percentileBadges'), 'justify-start', 'mt-3']">
            <span
              v-if="latestChartRecord.weightKg != null"
              :class="[ws('percentileBadge'), historyPercentileBadgeClass(latestChartRecord.weightPercentile ?? null, 'weight')]"
            >
              <span :class="ws('percentileBadgeLabel')">{{ t('growth.historyWeightPct') }}</span>
              {{ formatPercentileDisplay(latestChartRecord.weightPercentile ?? null) }}
            </span>
            <span
              v-if="latestChartRecord.heightCm != null"
              :class="[ws('percentileBadge'), historyPercentileBadgeClass(latestChartRecord.heightPercentile ?? null, 'height')]"
            >
              <span :class="ws('percentileBadgeLabel')">{{ t('growth.historyHeightPct') }}</span>
              {{ formatPercentileDisplay(latestChartRecord.heightPercentile ?? null) }}
            </span>
            <span
              v-if="latestChartRecord.weightKg != null && latestChartRecord.heightCm != null"
              :class="[ws('percentileBadge'), historyPercentileBadgeClass(latestChartRecord.bmiPercentile ?? null, 'bmi')]"
            >
              <span :class="ws('percentileBadgeLabel')">{{ t('growth.historyBmiPct') }}</span>
              {{ formatPercentileDisplay(latestChartRecord.bmiPercentile ?? null) }}
            </span>
          </div>
          <p
            v-if="latestChartRecord && formatBmiKgM2(latestChartRecord)"
            class="mt-2 text-xs leading-relaxed text-slate-600"
          >
            {{ t('growth.chart.bmiValueLine', { bmi: formatBmiKgM2(latestChartRecord) }) }}
          </p>
          <p
            v-if="latestChartRecord && isTallLeanGrowthPattern(latestChartRecord)"
            class="mt-2 text-xs leading-relaxed text-slate-600"
          >
            {{ t('growth.bmiTallLeanHint', { weightPct: Math.round(latestChartRecord.weightPercentile ?? 0) }) }}
          </p>
          <p
            v-else-if="latestChartRecord?.bmiPercentile != null && latestChartRecord.bmiPercentile < 15"
            class="mt-2 text-xs leading-relaxed text-slate-600"
          >
            {{ t('growth.chart.bmiContextHint', { weightPct: Math.round(latestChartRecord.weightPercentile ?? 0) }) }}
          </p>
        </div>
        <div :class="ws('callout')">
          <p :class="ws('calloutTitle')">{{ t('growth.chart.referenceLinesTitle') }}</p>
          <ul class="space-y-1.5">
            <li class="flex gap-2">
              <span class="mt-1.5 inline-block h-0.5 w-4 shrink-0 rounded bg-slate-400" aria-hidden="true" />
              <span>
                <span :class="ws('calloutStrong')">{{ t('growth.chart.legendP50') }}:</span>
                {{ t('growth.chart.p50Importance') }}
              </span>
            </li>
            <li class="flex gap-2">
              <span class="mt-1.5 inline-block h-0.5 w-4 shrink-0 rounded border-b border-dashed border-rose-300" aria-hidden="true" />
              <span>
                <span :class="ws('calloutStrong')">{{ t('growth.chart.legendP3') }}:</span>
                {{ t('growth.chart.p3Importance') }}
              </span>
            </li>
            <li class="flex gap-2">
              <span class="mt-1.5 inline-block h-0.5 w-4 shrink-0 rounded border-b border-dashed border-orange-300" aria-hidden="true" />
              <span>
                <span :class="ws('calloutStrong')">{{ t('growth.chart.legendP97') }}:</span>
                {{ t('growth.chart.p97Importance') }}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div ref="manualEntryRef" :class="[ws('panel'), ws('collapsible')]">
        <button
          type="button"
          :class="ws('collapsibleTrigger')"
          :aria-expanded="manualEntryOpen"
          @click="manualEntryOpen = !manualEntryOpen"
        >
          <span>{{ session.editingRecordId ? t('growth.editReading') : t('growth.manualEntry') }}</span>
          <span class="shrink-0 text-xs text-slate-500" aria-hidden="true">{{ manualEntryOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="manualEntryOpen" :class="[ws('collapsibleBody'), ws('panelStack')]">
        <div>
          <label for="growth-recorded-date" :class="ws('fieldLabel')">
            {{ t('growth.recordedDate') }}
          </label>
          <input
            id="growth-recorded-date"
            type="date"
            :class="ws('inputCompact')"
            :value="session.entryRecordedDate || todayDateValue"
            :min="selectedChild?.dateOfBirth"
            :max="todayDateValue"
            @input="onField('entryRecordedDate', $event)"
          />
          <p :class="ws('hint')">{{ t('growth.recordedDateHint') }}</p>
        </div>
        <div :class="ws('formGrid')">
          <input :class="ws('input')" :placeholder="t('growth.heightCm')" :value="session.entryHeightCm" @input="onField('entryHeightCm', $event)" />
          <input :class="ws('input')" :placeholder="t('growth.weightKg')" :value="session.entryWeightKg" @input="onField('entryWeightKg', $event)" />
          <input :class="ws('input')" :placeholder="t('growth.headCircCm')" :value="session.entryHcCm" @input="onField('entryHcCm', $event)" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" :class="inlinePrimaryButtonClass" @click="run('save-manual-growth-reading')">
            {{ session.editingRecordId ? t('growth.updateReading') : t('growth.saveReading') }}
          </button>
          <button
            v-if="session.editingRecordId"
            type="button"
            :class="inlineSecondaryButtonClass"
            @click="run('cancel-edit-growth-record')"
          >
            {{ t('growth.cancelEdit') }}
          </button>
        </div>
        </div>
      </div>

      <div v-if="chartRecords.length" :class="ws('panel')">
        <h3 :class="ws('sectionTitle')">{{ t('growth.history') }}</h3>
        <ul :class="ws('historyList')">
          <li
            v-for="record in historyRecordsDesc"
            :key="record.externalId"
            :class="[
              ws('historyRow'),
              session.editingRecordId === record.externalId ? ws('historyRowEditing') : ''
            ]"
          >
            <div :class="ws('historyRowMain')">
              <div :class="ws('historyRowTop')">
                <div class="min-w-0 space-y-1">
                  <p :class="ws('historyDate')">{{ new Date(record.recordedAt).toLocaleDateString() }}</p>
                  <p v-if="historyAgeLabel(record)" :class="ws('historyAge')">
                    {{ historyAgeLabel(record) }}
                  </p>
                  <p :class="ws('historyValues')">
                    <template v-if="record.weightKg != null">{{ record.weightKg }} kg</template>
                    <template v-if="record.heightCm != null"> · {{ record.heightCm }} cm</template>
                    <template v-if="formatBmiKgM2(record)"> · {{ formatBmiKgM2(record) }} {{ t('growth.historyBmiUnit') }}</template>
                    <template v-if="record.headCircumferenceCm != null"> · {{ record.headCircumferenceCm }} cm HC</template>
                  </p>
                </div>
                <button
                  v-if="record.externalId"
                  type="button"
                  :class="[
                    ws('editActionButton'),
                    session.editingRecordId === record.externalId ? ws('editActionButtonActive') : ''
                  ]"
                  :aria-label="t('growth.editReadingAria')"
                  :aria-pressed="session.editingRecordId === record.externalId"
                  @click="startEditRecord(record)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 shrink-0" aria-hidden="true">
                    <path d="m2.695 14.762-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
                  </svg>
                  <span>{{ t('growth.editLabel') }}</span>
                </button>
              </div>
              <div :class="ws('percentileGroup')">
                <p :class="[ws('percentileHeading'), '!text-left']">
                  {{ t('growth.historyPercentiles') }}
                </p>
                <div :class="[ws('percentileBadges'), '!justify-start']">
                <span
                  v-if="record.weightKg != null"
                  :class="[ws('percentileBadge'), historyPercentileBadgeClass(record.weightPercentile ?? null, 'weight')]"
                >
                  <span :class="ws('percentileBadgeLabel')">{{ t('growth.historyWeightPct') }}</span>
                  {{ formatPercentileDisplay(record.weightPercentile ?? null) }}
                </span>
                <span
                  v-if="record.heightCm != null"
                  :class="[ws('percentileBadge'), historyPercentileBadgeClass(record.heightPercentile ?? null, 'height')]"
                >
                  <span :class="ws('percentileBadgeLabel')">{{ t('growth.historyHeightPct') }}</span>
                  {{ formatPercentileDisplay(record.heightPercentile ?? null) }}
                </span>
                <span
                  v-if="record.weightKg != null && record.heightCm != null"
                  :class="[ws('percentileBadge'), historyPercentileBadgeClass(record.bmiPercentile ?? null, 'bmi')]"
                  :title="isTallLeanGrowthPattern(record) ? t('growth.bmiTallLeanHint') : undefined"
                >
                  <span :class="ws('percentileBadgeLabel')">{{ t('growth.historyBmiPct') }}</span>
                  {{ formatPercentileDisplay(record.bmiPercentile ?? null) }}
                </span>
              </div>
              </div>
              <p
                v-if="resolveRecordCharacteristics(record).phrase"
                :class="[ws('historySummary'), 'font-medium text-slate-800 !mt-2']"
              >
                {{ t('growth.profilePhrase', { phrase: resolveRecordCharacteristics(record).phrase }) }}
              </p>
              <p
                v-if="historySummaries[record.externalId]"
                :class="ws('historySummary')"
              >
                {{ historySummaries[record.externalId] }}
              </p>
              <p
                v-else-if="summaryInflightIds[record.externalId]"
                :class="[ws('historySummary'), 'text-slate-500 italic']"
              >
                {{ t('growth.historySummaryLoading') }}
              </p>
            </div>
          </li>
        </ul>
        <div :class="ws('guidePanel')">
          <p :class="ws('guideTitle')">{{ t('growth.percentileGuide.title') }}</p>
          <p class="mt-2">{{ t('growth.percentileGuide.intro') }}</p>
          <p class="mt-2">{{ t('growth.percentileGuide.example') }}</p>
          <p class="mt-2">{{ t('growth.percentileGuide.positiveUse') }}</p>
          <p class="mt-2">{{ t('growth.percentileGuide.doctorVisit') }}</p>
          <p class="mt-2">{{ t('growth.percentileGuide.bmiNote') }}</p>
        </div>
      </div>
    </div>

    <p v-else-if="!session.loading" :class="ws('emptyText')">{{ t('growth.noChildYet') }}</p>
  </div>
</template>
