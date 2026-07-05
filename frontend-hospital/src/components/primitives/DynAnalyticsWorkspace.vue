<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  LineElement,
  PointElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'vue-chartjs';
import { useAppStore } from '../../store/useAppStore';
import { useActionEngine } from '../../composables/useActionEngine';
import { hospitalPages } from '../../configs/hospital/pages';
import { pickString } from '../../services/domain/hospital/shared/strings';

const dashboardPageConfig =
  hospitalPages.find((page) => page.pageId === 'dashboard') ?? hospitalPages[0]!;
const engine = useActionEngine(dashboardPageConfig);

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  LineElement,
  PointElement
);

const { t } = useI18n();
const appStore = useAppStore();
const stackedTrend = ref(true);

const state = computed(() => (appStore.getData('hospital', 'AnalyticsDashboard') ?? {}) as Record<string, unknown>);
const auth = computed(() => (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>);
const role = computed(() => String(auth.value.role ?? '').trim().toUpperCase());
const overview = computed(() => (state.value.overview ?? {}) as Record<string, unknown>);
const loading = computed(() => Boolean(state.value.loading));
const error = computed(() => String(state.value.error ?? '').trim());
const filteredDoctorName = computed(() => String(state.value.filteredDoctorName ?? '').trim());

const summary = computed(() => (overview.value.SummaryStats ?? overview.value.summaryStats ?? {}) as Record<string, unknown>);
const previous = computed(() => (overview.value.PreviousPeriod ?? overview.value.previousPeriod ?? {}) as Record<string, unknown>);
const retention = computed(() => (overview.value.Retention ?? overview.value.retention ?? {}) as Record<string, unknown>);
const dailyTrend = computed(() => {
  const raw = overview.value.DailyTrend ?? overview.value.dailyTrend;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
});
const heatmap = computed(() => {
  const raw = overview.value.Heatmap ?? overview.value.heatmap;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
});
const newVsReturning = computed(() => {
  const raw = overview.value.NewVsReturning ?? overview.value.newVsReturning;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
});
const doctors = computed(() => {
  const raw = state.value.doctors;
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
});

const lastRefreshed = computed(() => {
  const raw = overview.value.LastRefreshedAt ?? overview.value.lastRefreshedAt;
  if (!raw) return '';
  try {
    return new Date(String(raw)).toLocaleString();
  } catch {
    return '';
  }
});

function num(row: Record<string, unknown>, keys: string[]): number {
  const v = pickString(row, keys);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pctDelta(current: number, prev: number): number | null {
  if (prev <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - prev) / prev) * 100);
}

const statCards = computed(() => {
  const cur = summary.value;
  const prv = previous.value;
  const items = [
    { key: 'appointments', label: t('analytics.cards.appointments'), value: num(cur, ['TotalAppointments', 'totalAppointments']), prev: num(prv, ['TotalAppointments', 'totalAppointments']), higherIsBetter: true },
    { key: 'completion', label: t('analytics.cards.completion'), value: num(cur, ['CompletionRatePct', 'completionRatePct']), prev: num(prv, ['CompletionRatePct', 'completionRatePct']), higherIsBetter: true, suffix: '%' },
    { key: 'patients', label: t('analytics.cards.patients'), value: num(cur, ['TotalUniquePatients', 'totalUniquePatients']), prev: num(prv, ['TotalUniquePatients', 'totalUniquePatients']), higherIsBetter: true },
    { key: 'return', label: t('analytics.cards.returnRate'), value: num(cur, ['ReturnRatePct', 'returnRatePct']), prev: num(prv, ['ReturnRatePct', 'returnRatePct']), higherIsBetter: true, suffix: '%' }
  ];
  return items.map((item) => {
    const delta = pctDelta(item.value, item.prev);
    const improved = delta == null ? null : item.higherIsBetter ? delta >= 0 : delta <= 0;
    return { ...item, delta, improved };
  });
});

const trendChartData = computed(() => {
  const rows = dailyTrend.value;
  const labels = rows.map((r) => pickString(r, ['AppointmentDate', 'appointmentDate']));
  if (stackedTrend.value) {
    return {
      labels,
      datasets: [
        { label: t('analytics.outcomes.completed'), data: rows.map((r) => num(r, ['TotalCompleted', 'totalCompleted'])), backgroundColor: '#4CAF50', stack: 's' },
        { label: t('analytics.outcomes.noShow'), data: rows.map((r) => num(r, ['TotalNoShow', 'totalNoShow'])), backgroundColor: '#F44336', stack: 's' },
        { label: t('analytics.outcomes.cancelled'), data: rows.map((r) => num(r, ['TotalCancelled', 'totalCancelled'])), backgroundColor: '#FF9800', stack: 's' },
        { label: t('analytics.outcomes.rescheduled'), data: rows.map((r) => num(r, ['TotalRescheduled', 'totalRescheduled'])), backgroundColor: '#9E9E9E', stack: 's' }
      ]
    };
  }
  return {
    labels,
    datasets: [
      { label: t('analytics.outcomes.completed'), data: rows.map((r) => num(r, ['TotalCompleted', 'totalCompleted'])), backgroundColor: '#4CAF50' },
      { label: t('analytics.outcomes.noShow'), data: rows.map((r) => num(r, ['TotalNoShow', 'totalNoShow'])), backgroundColor: '#F44336' },
      { label: t('analytics.outcomes.cancelled'), data: rows.map((r) => num(r, ['TotalCancelled', 'totalCancelled'])), backgroundColor: '#FF9800' },
      { label: t('analytics.outcomes.rescheduled'), data: rows.map((r) => num(r, ['TotalRescheduled', 'totalRescheduled'])), backgroundColor: '#9E9E9E' }
    ]
  };
});

const donutData = computed(() => {
  const completed = num(summary.value, ['TotalCompleted', 'totalCompleted']);
  const noShow = num(summary.value, ['TotalNoShows', 'totalNoShows']);
  const cancelled = num(summary.value, ['TotalCancelled', 'totalCancelled']);
  const rescheduled = num(summary.value, ['TotalRescheduled', 'totalRescheduled']);
  const labels: string[] = [];
  const data: number[] = [];
  const colors: string[] = [];
  const entries = [
    [t('analytics.outcomes.completed'), completed, '#4CAF50'],
    [t('analytics.outcomes.noShow'), noShow, '#F44336'],
    [t('analytics.outcomes.cancelled'), cancelled, '#FF9800'],
    [t('analytics.outcomes.rescheduled'), rescheduled, '#9E9E9E']
  ] as const;
  for (const [label, value, color] of entries) {
    if (value > 0) {
      labels.push(label);
      data.push(value);
      colors.push(color);
    }
  }
  return { labels, datasets: [{ data, backgroundColor: colors }] };
});

const lineData = computed(() => ({
  labels: newVsReturning.value.map((r) => pickString(r, ['Month', 'month'])),
  datasets: [
    {
      label: t('analytics.newPatients'),
      data: newVsReturning.value.map((r) => num(r, ['NewPatients', 'newPatients'])),
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.1)',
      tension: 0.3
    },
    {
      label: t('analytics.returningPatients'),
      data: newVsReturning.value.map((r) => num(r, ['ReturningPatients', 'returningPatients'])),
      borderColor: '#16a34a',
      borderDash: [6, 4],
      backgroundColor: 'rgba(22,163,74,0.08)',
      tension: 0.3
    }
  ]
}));

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const heatmapGrid = computed(() => {
  const cells = heatmap.value;
  const max = cells.reduce((m, c) => Math.max(m, num(c, ['TotalBooked', 'totalBooked'])), 0);
  const grid: Array<{ dow: number; hour: number; booked: number; noShowRate: number }> = [];
  for (let dow = 0; dow <= 6; dow += 1) {
    for (let hour = 7; hour <= 21; hour += 1) {
      const match = cells.find(
        (c) => num(c, ['DayOfWeek', 'dayOfWeek']) === dow && num(c, ['HourSlot', 'hourSlot']) === hour
      );
      grid.push({
        dow,
        hour,
        booked: match ? num(match, ['TotalBooked', 'totalBooked']) : 0,
        noShowRate: match ? num(match, ['NoShowRatePct', 'noShowRatePct']) : 0
      });
    }
  }
  return { grid, max };
});

const heatmapInsights = computed(() => {
  const cells = heatmap.value.filter((c) => num(c, ['TotalBooked', 'totalBooked']) > 0);
  if (!cells.length) return { busiest: '', risk: '' };
  const busiest = [...cells].sort((a, b) => num(b, ['TotalBooked', 'totalBooked']) - num(a, ['TotalBooked', 'totalBooked']))[0];
  const risk = [...cells].sort((a, b) => num(b, ['NoShowRatePct', 'noShowRatePct']) - num(a, ['NoShowRatePct', 'noShowRatePct']))[0];
  const fmt = (c: Record<string, unknown>) =>
    `${dayLabels[num(c, ['DayOfWeek', 'dayOfWeek'])] ?? ''} ${num(c, ['HourSlot', 'hourSlot'])}:00`;
  return {
    busiest: t('analytics.heatmap.busiest', { slot: fmt(busiest), count: num(busiest, ['TotalBooked', 'totalBooked']) }),
    risk: t('analytics.heatmap.noShowRisk', { slot: fmt(risk), pct: num(risk, ['NoShowRatePct', 'noShowRatePct']) })
  };
});

const funnelStages = computed(() => {
  const total = num(retention.value, ['TotalUniquePatients', 'totalUniquePatients']);
  const single = num(retention.value, ['SingleVisitPatients', 'singleVisitPatients']);
  const returning = num(retention.value, ['ReturningPatients', 'returningPatients']);
  const loyal = num(retention.value, ['LoyalPatients', 'loyalPatients']);
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return [
    { label: t('analytics.funnel.total'), count: total, width: 100 },
    { label: t('analytics.funnel.once'), count: single, width: pct(single) },
    { label: t('analytics.funnel.returning'), count: returning, width: pct(returning) },
    { label: t('analytics.funnel.loyal'), count: loyal, width: pct(loyal) }
  ];
});

const returnRate = computed(() => num(retention.value, ['ReturnRatePct', 'returnRatePct']));
const retentionBadge = computed(() => {
  if (returnRate.value > 40) return { text: t('analytics.retention.healthy'), class: 'bg-emerald-100 text-emerald-800' };
  if (returnRate.value >= 20) return { text: t('analytics.retention.improve'), class: 'bg-amber-100 text-amber-800' };
  return { text: t('analytics.retention.low'), class: 'bg-red-100 text-red-800' };
});

const showDoctorTable = computed(() => role.value === 'ADMIN' && doctors.value.length > 1);

function cellColor(booked: number, max: number): string {
  if (booked <= 0 || max <= 0) return '#f8fafc';
  const ratio = booked / max;
  if (ratio < 0.25) return '#ccfbf1';
  if (ratio < 0.5) return '#5eead4';
  if (ratio < 0.75) return '#14b8a6';
  return '#0f766e';
}

async function runAction(actionId: string, data: Record<string, unknown> = {}): Promise<void> {
  await engine.execute({ actionId, data });
}

async function setRange(preset: string): Promise<void> {
  await runAction('set-analytics-date-range', { preset });
}

async function exportCsv(type: string): Promise<void> {
  await runAction('export-analytics-csv', { type });
}

async function filterDoctor(row: Record<string, unknown>): Promise<void> {
  await runAction('filter-analytics-doctor', {
    doctorId: pickString(row, ['DoctorId', 'doctorId']),
    doctorName: pickString(row, ['DoctorName', 'doctorName'])
  });
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-slate-900">{{ t('analytics.title') }}</h2>
        <p v-if="lastRefreshed" class="text-xs text-slate-500 mt-1">
          {{ t('analytics.dataUpdated', { time: lastRefreshed }) }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="rounded-md border px-3 py-1 text-xs" @click="setRange('7d')">7D</button>
        <button type="button" class="rounded-md border px-3 py-1 text-xs" @click="setRange('30d')">30D</button>
        <button type="button" class="rounded-md border px-3 py-1 text-xs" @click="setRange('90d')">90D</button>
        <button type="button" class="rounded-md border border-slate-300 px-3 py-1 text-xs" @click="exportCsv('appointments')">
          {{ t('analytics.export') }}
        </button>
      </div>
    </div>

    <div v-if="filteredDoctorName" class="flex items-center gap-2 text-sm text-slate-600">
      <span>{{ t('analytics.viewingDoctor', { name: filteredDoctorName }) }}</span>
      <button type="button" class="text-sky-700 underline" @click="runAction('clear-analytics-doctor-filter')">✕</button>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div v-for="i in 4" :key="i" class="h-24 rounded-xl bg-slate-100 animate-pulse" />
    </div>

    <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="card in statCards"
        :key="card.key"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <p class="text-3xl font-bold text-slate-900">{{ card.value }}{{ card.suffix ?? '' }}</p>
        <p class="text-sm text-slate-600 mt-1">{{ card.label }}</p>
        <p
          v-if="card.delta != null"
          class="text-xs mt-2"
          :class="card.improved ? 'text-emerald-600' : 'text-red-600'"
        >
          {{ card.improved ? '↑' : '↓' }} {{ Math.abs(card.delta) }}% {{ t('analytics.vsPrevPeriod') }}
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-800">{{ t('analytics.trendTitle') }}</h3>
          <button type="button" class="text-xs text-slate-500 underline" @click="stackedTrend = !stackedTrend">
            {{ stackedTrend ? t('analytics.stacked') : t('analytics.grouped') }}
          </button>
        </div>
        <Bar v-if="dailyTrend.length >= 3" :data="trendChartData" :options="{ responsive: true, plugins: { legend: { position: 'bottom' } } }" />
        <p v-else class="text-sm text-slate-500 py-8 text-center">{{ t('analytics.notEnoughData') }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-slate-800 mb-3">{{ t('analytics.outcomesTitle') }}</h3>
        <Doughnut v-if="donutData.datasets[0].data.length" :data="donutData" :options="{ responsive: true, plugins: { legend: { position: 'bottom' } } }" />
        <p v-else class="text-sm text-slate-500 py-8 text-center">{{ t('analytics.notEnoughData') }}</p>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-800">{{ t('analytics.heatmapTitle') }}</h3>
        <span class="text-xs text-slate-400">{{ t('analytics.allTime') }}</span>
      </div>
      <div class="overflow-x-auto">
        <div class="inline-grid gap-0.5" style="grid-template-columns: 48px repeat(7, 28px)">
          <div />
          <div v-for="(label, idx) in dayLabels" :key="label" class="text-[10px] text-center text-slate-500">{{ label }}</div>
          <template v-for="hour in Array.from({ length: 15 }, (_, i) => i + 7)" :key="hour">
            <div class="text-[10px] text-slate-500 pr-1 text-right">{{ hour }}</div>
            <div
              v-for="dow in 7"
              :key="`${dow}-${hour}`"
              class="relative h-7 w-7 rounded-sm border border-slate-100"
              :style="{
                backgroundColor: cellColor(
                  heatmapGrid.grid.find((c) => c.dow === dow - 1 && c.hour === hour)?.booked ?? 0,
                  heatmapGrid.max
                )
              }"
              :title="String(heatmapGrid.grid.find((c) => c.dow === dow - 1 && c.hour === hour)?.booked ?? 0)"
            >
              <span
                v-if="(heatmapGrid.grid.find((c) => c.dow === dow - 1 && c.hour === hour)?.noShowRate ?? 0) > 25"
                class="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-red-500"
              />
            </div>
          </template>
        </div>
      </div>
      <div class="mt-3 space-y-1 text-xs text-slate-600">
        <p v-if="heatmapInsights.busiest">{{ heatmapInsights.busiest }}</p>
        <p v-if="heatmapInsights.risk">{{ heatmapInsights.risk }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-800">{{ t('analytics.newVsReturningTitle') }}</h3>
          <span class="text-xs text-slate-400">{{ t('analytics.allTime') }}</span>
        </div>
        <Line v-if="newVsReturning.length >= 2" :data="lineData" :options="{ responsive: true, plugins: { legend: { position: 'bottom' } } }" />
        <p v-else class="text-sm text-slate-500 py-8 text-center">{{ t('analytics.notEnoughData') }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-800">{{ t('analytics.funnelTitle') }}</h3>
          <span class="text-xs text-slate-400">{{ t('analytics.allTime') }}</span>
        </div>
        <div class="space-y-2">
          <div v-for="stage in funnelStages" :key="stage.label" class="flex items-center gap-2">
            <div class="h-8 rounded bg-teal-600/80" :style="{ width: `${Math.max(stage.width, 8)}%` }" />
            <span class="text-xs text-slate-700 whitespace-nowrap">{{ stage.label }}: {{ stage.count }}</span>
          </div>
        </div>
        <span class="inline-block mt-3 rounded-full px-2 py-1 text-xs" :class="retentionBadge.class">{{ retentionBadge.text }}</span>
      </div>
    </div>

    <div v-if="showDoctorTable" class="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
      <h3 class="text-sm font-semibold text-slate-800 mb-3">{{ t('analytics.doctorComparison') }}</h3>
      <table class="min-w-full text-xs text-left">
        <thead class="text-slate-500 border-b">
          <tr>
            <th class="py-2 pr-4">{{ t('analytics.doctorName') }}</th>
            <th class="py-2 pr-4">{{ t('analytics.cards.appointments') }}</th>
            <th class="py-2 pr-4">{{ t('analytics.cards.completion') }}</th>
            <th class="py-2 pr-4">{{ t('analytics.outcomes.noShow') }}</th>
            <th class="py-2 pr-4">{{ t('analytics.cards.patients') }}</th>
            <th class="py-2">{{ t('analytics.cards.returnRate') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in doctors"
            :key="idx"
            class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
            @click="filterDoctor(row)"
          >
            <td class="py-2 pr-4 font-medium">{{ pickString(row, ['DoctorName', 'doctorName']) }}</td>
            <td class="py-2 pr-4">{{ num(row, ['TotalAppointments', 'totalAppointments']) }}</td>
            <td class="py-2 pr-4">{{ num(row, ['CompletionRatePct', 'completionRatePct']) }}%</td>
            <td class="py-2 pr-4">{{ num(row, ['NoShowRatePct', 'noShowRatePct']) }}%</td>
            <td class="py-2 pr-4">{{ num(row, ['TotalUniquePatients', 'totalUniquePatients']) }}</td>
            <td class="py-2">{{ num(row, ['ReturnRatePct', 'returnRatePct']) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
