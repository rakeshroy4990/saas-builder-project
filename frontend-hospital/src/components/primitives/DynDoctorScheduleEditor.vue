<script setup lang="ts">
import { computed, reactive } from 'vue';
import type { PageConfig } from '../../core/types/PageConfig';
import { useActionEngine } from '../../composables/useActionEngine';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';

const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'] as const;
const WEEKEND = ['SAT', 'SUN'] as const;
const DAY_LABEL: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday'
};

type DayCfg = { enabled: boolean; slotMinutes: number; windows: { start: string; end: string }[] };

const props = defineProps<{
  pageConfig: PageConfig;
  config?: Record<string, unknown>;
  htmlId?: string;
}>();

const { execute } = useActionEngine(props.pageConfig);
const appStore = useAppStore(pinia);

const weekly = computed(() => {
  const form = (appStore.getData('hospital', 'DoctorScheduleForm') ?? {}) as Record<string, unknown>;
  return (form.weekly ?? {}) as Record<string, DayCfg>;
});

function dayOf(key: (typeof DAY_KEYS)[number]): DayCfg {
  const d = weekly.value[key];
  if (d && typeof d === 'object') {
    return {
      enabled: Boolean(d.enabled),
      slotMinutes: d.slotMinutes === 30 ? 30 : 15,
      windows: Array.isArray(d.windows) && d.windows.length > 0 ? d.windows.map(cloneWin) : [{ start: '09:00', end: '17:00' }]
    };
  }
  return { enabled: false, slotMinutes: 15, windows: [{ start: '09:00', end: '17:00' }] };
}

function cloneWin(w: { start: string; end: string }) {
  return { start: String(w.start ?? ''), end: String(w.end ?? '') };
}

function cloneDayFull(d: DayCfg): DayCfg {
  return {
    enabled: Boolean(d.enabled),
    slotMinutes: d.slotMinutes === 30 ? 30 : 15,
    windows: (Array.isArray(d.windows) && d.windows.length > 0 ? d.windows : [{ start: '09:00', end: '17:00' }]).map(
      cloneWin
    )
  };
}

/** For each source day, which other days are selected for “copy setup”. */
const copyTargets = reactive(
  Object.fromEntries(
    DAY_KEYS.map((k) => [
      k,
      Object.fromEntries(DAY_KEYS.filter((t) => t !== k).map((t) => [t, false])) as Record<(typeof DAY_KEYS)[number], boolean>
    ])
  ) as Record<(typeof DAY_KEYS)[number], Record<(typeof DAY_KEYS)[number], boolean>>
);

function otherDayKeys(source: (typeof DAY_KEYS)[number]): (typeof DAY_KEYS)[number][] {
  return DAY_KEYS.filter((k) => k !== source);
}

function weekdayOthers(source: (typeof DAY_KEYS)[number]): (typeof DAY_KEYS)[number][] {
  return WEEKDAYS.filter((k) => k !== source) as (typeof DAY_KEYS)[number][];
}

function weekendOthers(source: (typeof DAY_KEYS)[number]): (typeof DAY_KEYS)[number][] {
  return WEEKEND.filter((k) => k !== source) as (typeof DAY_KEYS)[number][];
}

function copyDayToTargets(source: (typeof DAY_KEYS)[number], targets: (typeof DAY_KEYS)[number][]) {
  if (targets.length === 0) return;
  const template = cloneDayFull(dayOf(source));
  const next = { ...weekly.value } as Record<string, DayCfg>;
  for (const t of targets) {
    next[t] = cloneDayFull(template);
  }
  commit(next);
  for (const t of otherDayKeys(source)) {
    copyTargets[source][t] = false;
  }
}

function copyDayToSelected(source: (typeof DAY_KEYS)[number]) {
  const targets = otherDayKeys(source).filter((t) => copyTargets[source][t]);
  copyDayToTargets(source, targets);
}

function commit(next: Record<string, DayCfg>) {
  appStore.setData('hospital', 'DoctorScheduleForm', { weekly: next });
}

function setEnabled(key: (typeof DAY_KEYS)[number], enabled: boolean) {
  const w = { ...weekly.value };
  const cur = dayOf(key);
  w[key] = { ...cur, enabled };
  commit(w);
}

function setSlotMinutes(key: (typeof DAY_KEYS)[number], slotMinutes: 15 | 30) {
  const w = { ...weekly.value };
  const cur = dayOf(key);
  w[key] = { ...cur, slotMinutes };
  commit(w);
}

function setWindowField(key: (typeof DAY_KEYS)[number], index: number, field: 'start' | 'end', value: string) {
  const w = { ...weekly.value };
  const cur = dayOf(key);
  const wins = cur.windows.map((x, i) => (i === index ? { ...x, [field]: value } : { ...x }));
  w[key] = { ...cur, windows: wins };
  commit(w);
}

function addWindow(key: (typeof DAY_KEYS)[number]) {
  const w = { ...weekly.value };
  const cur = dayOf(key);
  w[key] = { ...cur, windows: [...cur.windows, { start: '13:00', end: '17:00' }] };
  commit(w);
}

function removeWindow(key: (typeof DAY_KEYS)[number], index: number) {
  const w = { ...weekly.value };
  const cur = dayOf(key);
  const wins = cur.windows.filter((_, i) => i !== index);
  w[key] = { ...cur, windows: wins.length > 0 ? wins : [{ start: '09:00', end: '17:00' }] };
  commit(w);
}

const loading = computed(() =>
  Boolean((appStore.getData('hospital', 'DoctorScheduleUi') as Record<string, unknown> | undefined)?.loading)
);

async function onSave() {
  await execute({ actionId: 'save-doctor-schedule' });
}
</script>

<template>
  <div :id="htmlId" class="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="max-w-2xl text-sm text-slate-600">
        Weekly hours use the hospital time zone configured on the server. Add multiple windows in one day for lunch
        breaks (gaps).
      </p>
      <button
        type="button"
        class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        :disabled="loading"
        @click="onSave"
      >
        Save schedule
      </button>
    </div>
    <div class="space-y-3">
      <div
        v-for="key in DAY_KEYS"
        :key="key"
        class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-2 mb-3">
          <label class="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" :checked="dayOf(key).enabled" @change="setEnabled(key, ($event.target as HTMLInputElement).checked)" />
            {{ DAY_LABEL[key] }}
          </label>
          <div class="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>Slot length</span>
            <label class="inline-flex items-center gap-1">
              <input
                type="radio"
                :name="`slot-${key}`"
                :checked="dayOf(key).slotMinutes === 15"
                @change="setSlotMinutes(key, 15)"
              />
              15 min
            </label>
            <label class="inline-flex items-center gap-1">
              <input
                type="radio"
                :name="`slot-${key}`"
                :checked="dayOf(key).slotMinutes === 30"
                @change="setSlotMinutes(key, 30)"
              />
              30 min
            </label>
          </div>
        </div>
        <div v-if="dayOf(key).enabled" class="space-y-2">
          <div
            v-for="(win, idx) in dayOf(key).windows"
            :key="`${key}-${idx}`"
            class="flex flex-wrap items-end gap-2"
          >
            <label class="text-xs font-medium text-slate-600">
              Start
              <input
                type="time"
                class="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                :value="win.start"
                @input="setWindowField(key, idx, 'start', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="text-xs font-medium text-slate-600">
              End
              <input
                type="time"
                class="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                :value="win.end"
                @input="setWindowField(key, idx, 'end', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <button
              type="button"
              class="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              @click="addWindow(key)"
            >
              Add window
            </button>
            <button
              v-if="dayOf(key).windows.length > 1"
              type="button"
              class="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
              @click="removeWindow(key, idx)"
            >
              Remove
            </button>
          </div>
        </div>
        <p v-else class="text-xs text-slate-500">Day off — not bookable.</p>
        <details class="mt-3 border-t border-slate-100 pt-2">
          <summary class="cursor-pointer select-none text-xs font-semibold text-emerald-700 hover:underline">
            Copy this day's setup to other days
          </summary>
          <div class="mt-2 space-y-2 rounded-md border border-slate-100 bg-slate-50/90 p-2">
            <p class="text-xs text-slate-600">
              Copies slot length, on/off, and all time windows. Use quick actions or pick days below.
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                title="Monday through Friday (except this day if it is a weekday)"
                class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                :disabled="loading"
                @click="copyDayToTargets(key, weekdayOthers(key))"
              >
                Copy to Mon–Fri
              </button>
              <button
                type="button"
                title="Saturday and Sunday (except this day if it is a weekend day)"
                class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                :disabled="loading"
                @click="copyDayToTargets(key, weekendOthers(key))"
              >
                Copy to Sat–Sun
              </button>
              <button
                type="button"
                title="All other days of the week"
                class="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
                :disabled="loading"
                @click="copyDayToTargets(key, otherDayKeys(key))"
              >
                Copy to all other days
              </button>
            </div>
            <div class="flex flex-wrap gap-x-3 gap-y-1">
              <label
                v-for="t in otherDayKeys(key)"
                :key="`${key}-copy-${t}`"
                class="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700"
              >
                <input v-model="copyTargets[key][t]" type="checkbox" class="rounded border-slate-300 text-emerald-600" />
                {{ DAY_LABEL[t] }}
              </label>
            </div>
            <button
              type="button"
              class="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!otherDayKeys(key).some((t) => copyTargets[key][t])"
              @click="copyDayToSelected(key)"
            >
              Copy to selected days
            </button>
          </div>
        </details>
      </div>
    </div>
  </div>
</template>
