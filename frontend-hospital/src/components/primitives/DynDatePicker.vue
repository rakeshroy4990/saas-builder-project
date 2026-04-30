<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';

type SlotCountRow = {
  date?: string;
  slotCount?: number;
};

interface DatePickerConfig {
  label?: string;
  value?: string;
  disabled?: boolean;
  min?: string;
  unavailableDates?: string[];
  slotCounts?: SlotCountRow[];
  styles?: StyleConfig;
  labelStyles?: StyleConfig;
  change?: ActionConfig;
}

type CalendarDay = {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
  disabled: boolean;
  slotCount: number | null;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

const props = defineProps<{ config?: DatePickerConfig; htmlId?: string }>();
const emit = defineEmits<{ action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }] }>();

const model = ref('');
const panelOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);
const classes = computed(() => resolveStyle(props.config?.styles));
const labelClass = computed(() =>
  resolveStyle(props.config?.labelStyles ?? { styleTemplate: 'form.label.stack' })
);

const monthCursor = ref<Date>(new Date());
const selectedDate = computed(() => parseIsoDate(model.value));
const minDate = computed(() => parseIsoDate(String(props.config?.min ?? '').trim()));
const unavailableDateSet = computed(() => new Set((props.config?.unavailableDates ?? []).map((x) => String(x).trim())));
const slotCountMap = computed(() => {
  const map = new Map<string, number>();
  for (const row of props.config?.slotCounts ?? []) {
    const iso = String(row?.date ?? '').trim();
    if (!iso) continue;
    map.set(iso, Number(row?.slotCount ?? 0));
  }
  return map;
});

const fieldId = computed(() => (props.htmlId ? `${props.htmlId}-field` : undefined));
const labelTextId = computed(() => (props.htmlId ? `${props.htmlId}-label` : undefined));
const triggerId = computed(() => (props.htmlId ? `${props.htmlId}-trigger` : undefined));
const panelId = computed(() => (props.htmlId ? `${props.htmlId}-panel` : undefined));

const monthTitle = computed(() => MONTH_FORMATTER.format(monthCursor.value));
const calendarDays = computed<CalendarDay[]>(() => {
  const year = monthCursor.value.getFullYear();
  const month = monthCursor.value.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const leadingDays = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: CalendarDay[] = [];

  for (let i = 0; i < leadingDays; i += 1) {
    const d = new Date(year, month, i - leadingDays + 1);
    cells.push(toCalendarDay(d, false));
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(toCalendarDay(new Date(year, month, d), true));
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const d = new Date(year, month + 1, cells.length - (leadingDays + daysInMonth) + 1);
    cells.push(toCalendarDay(d, false));
  }
  return cells;
});

function parseIsoDate(iso: string): Date | null {
  const raw = String(iso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toCalendarDay(date: Date, inCurrentMonth: boolean): CalendarDay {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const iso = toIsoDate(normalized);
  const min = minDate.value;
  const isBeforeMin = min ? normalized.getTime() < min.getTime() : false;
  const isUnavailable = unavailableDateSet.value.has(iso);
  return {
    iso,
    day: normalized.getDate(),
    inCurrentMonth,
    disabled: isBeforeMin || isUnavailable,
    slotCount: slotCountMap.value.has(iso) ? Number(slotCountMap.value.get(iso)) : null
  };
}

async function emitChange(): Promise<void> {
  emit('action', { action: props.config?.change, payload: { value: model.value } });
}

async function selectDay(day: CalendarDay): Promise<void> {
  if (props.config?.disabled) return;
  if (day.disabled) return;
  model.value = day.iso;
  const parsed = parseIsoDate(day.iso);
  if (parsed) {
    monthCursor.value = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }
  panelOpen.value = false;
  await emitChange();
}

function goPreviousMonth(): void {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() - 1, 1);
}

function goNextMonth(): void {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + 1, 1);
}

function onDocumentClick(event: MouseEvent): void {
  if (!panelOpen.value) return;
  const root = rootRef.value;
  if (!root) return;
  if (event.target instanceof Node && !root.contains(event.target)) {
    panelOpen.value = false;
  }
}

watch(
  () => props.config?.value,
  (nextValue) => {
    const resolved = nextValue == null ? '' : String(nextValue);
    if (resolved !== model.value) {
      model.value = resolved;
    }
    const parsed = parseIsoDate(resolved);
    if (parsed) {
      monthCursor.value = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
      return;
    }
    const min = minDate.value;
    monthCursor.value = min ? new Date(min.getFullYear(), min.getMonth(), 1) : new Date();
  },
  { immediate: true }
);

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <label :id="fieldId" ref="rootRef" :class="labelClass">
    <span v-if="config?.label" :id="labelTextId">{{ config.label }}</span>
    <div class="relative">
      <button
      :id="triggerId"
      class="relative block w-full text-left"
      type="button"
      :disabled="Boolean(config?.disabled)"
      @click="panelOpen = !panelOpen"
    >
      <input
        :value="model"
        :class="classes"
        type="text"
        placeholder="yyyy-mm-dd"
        :disabled="Boolean(config?.disabled)"
        readonly
      />
      <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">📅</span>
      </button>

      <div
        v-if="panelOpen"
        :id="panelId"
        class="absolute left-0 top-[calc(100%+8px)] z-40 w-full max-w-[360px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        role="dialog"
        aria-label="Choose date"
      >
      <div class="mb-1 flex items-center justify-between">
        <button type="button" class="rounded px-2 py-1 text-xs hover:bg-slate-100" @click="goPreviousMonth">‹</button>
        <div class="text-xs font-semibold text-slate-800">{{ monthTitle }}</div>
        <button type="button" class="rounded px-2 py-1 text-xs hover:bg-slate-100" @click="goNextMonth">›</button>
      </div>

      <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
        <div v-for="w in WEEKDAY_LABELS" :key="w" class="py-0.5">{{ w }}</div>
      </div>

      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="day in calendarDays"
          :key="day.iso"
          type="button"
          :disabled="day.disabled"
          :class="[
            'min-h-10 rounded border px-1 py-0.5 text-center transition',
            !day.inCurrentMonth && day.slotCount === null ? 'border-transparent text-slate-300' : '',
            day.disabled ? 'border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 hover:bg-slate-50',
            model === day.iso ? 'border-blue-500 bg-blue-50 text-blue-700' : ''
          ]"
          @click="selectDay(day)"
        >
          <div class="text-xs">{{ day.day }}</div>
          <div
            v-if="day.slotCount !== null"
            class="mt-0.5 text-[10px] font-bold"
            :class="day.slotCount > 0 ? 'text-emerald-700' : 'text-slate-400'"
          >
            {{ day.slotCount }}
          </div>
        </button>
      </div>
      </div>
    </div>
  </label>
</template>
