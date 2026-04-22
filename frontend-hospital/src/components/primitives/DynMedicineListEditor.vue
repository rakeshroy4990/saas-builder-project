<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { resolveStyle } from '../../core/engine/StyleResolver';
import type { ActionConfig } from '../../core/types/ActionConfig';
import type { StyleConfig } from '../../core/types/StyleConfig';
import { useMedicineSearch, type MedicineSearchResult } from '../../composables/useMedicineSearch';

type MedicineRow = {
  id: string;
  query: string;
  name: string;
  composition: string;
  manufacturer: string;
  dose: string;
  frequency: string;
  durationDays: string;
  route: string;
  instructions: string;
  selectedFromSearch: boolean;
  isDiscontinued: boolean;
};

interface MedicineListConfig {
  value?: string;
  styles?: StyleConfig;
  change?: ActionConfig;
}

const props = defineProps<{ config?: MedicineListConfig; htmlId?: string }>();
const emit = defineEmits<{
  action: [event: { action?: ActionConfig; payload?: Record<string, unknown> }];
}>();

const rootClass = computed(() =>
  resolveStyle(
    props.config?.styles ?? {
      utilityClasses: 'md:col-span-2 rounded-lg border border-slate-200 bg-white p-2 sm:p-3 space-y-3'
    }
  )
);

const rows = ref<MedicineRow[]>([]);
const activeRowId = ref('');
const editingRowId = ref('');
const searchQuery = ref('');
const forceShowErrorsForRowId = ref('');
const { results, isLoading } = useMedicineSearch(searchQuery);

const freqOptions = ['OD', 'BD', 'TDS', 'QID', 'SOS', 'HS'];
const routeOptions = ['Oral', 'Topical', 'Inhaled', 'IV', 'IM', 'Sublingual'];
const commonDoseOptions = ['250 mg', '500 mg', '650 mg', '1 tablet', '5 ml'];
const quickDurationOptions = ['3', '5', '7'];
const showInstructionsForRowId = ref('');

const fallbackMatches = reactive<MedicineSearchResult[]>([
  { id: 'fallback-para-650', name: 'Paracetamol 650', composition: 'Paracetamol', manufacturer: 'Generic' },
  { id: 'fallback-azee-500', name: 'Azee 500', composition: 'Azithromycin', manufacturer: 'Generic' },
  { id: 'fallback-pantop-40', name: 'Pantop 40', composition: 'Pantoprazole', manufacturer: 'Generic' },
  { id: 'fallback-aug-625', name: 'Augmentin 625', composition: 'Amoxycillin + Clavulanic Acid', manufacturer: 'Generic' }
]);

const visibleResults = computed(() => {
  if (results.value.length > 0) return results.value;
  const q = searchQuery.value.trim().toLowerCase();
  if (q.length < 2) return [];
  return fallbackMatches.filter(
    (entry) => entry.name.toLowerCase().includes(q) || entry.composition.toLowerCase().includes(q)
  );
});

function emptyRow(): MedicineRow {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: uid,
    query: '',
    name: '',
    composition: '',
    manufacturer: '',
    dose: '',
    frequency: '',
    durationDays: '',
    route: '',
    instructions: '',
    selectedFromSearch: false,
    isDiscontinued: false
  };
}

function parseIncoming(value: string | undefined): MedicineRow[] {
  const raw = String(value ?? '').trim();
  if (!raw) return [emptyRow()];
  try {
    const list = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(list) || list.length === 0) return [emptyRow()];
    return list.map((entry) => {
      const row = emptyRow();
      row.name = String(entry.name ?? '').trim();
      row.query = row.name;
      row.composition = String(entry.composition ?? '').trim();
      row.manufacturer = String(entry.manufacturer ?? '').trim();
      row.dose = String(entry.dose ?? '').trim();
      row.frequency = String(entry.frequency ?? '').trim();
      row.durationDays = String(entry.durationDays ?? '').trim();
      row.route = String(entry.route ?? '').trim();
      row.instructions = String(entry.instructions ?? '').trim();
      row.selectedFromSearch = row.name.length > 0;
      row.isDiscontinued = String(entry.isDiscontinued ?? '').toLowerCase() === 'true';
      return row;
    });
  } catch {
    return [emptyRow()];
  }
}

watch(
  () => props.config?.value,
  (next) => {
    rows.value = parseIncoming(next == null ? '' : String(next));
    if (!editingRowId.value || !rows.value.some((row) => row.id === editingRowId.value)) {
      editingRowId.value = rows.value[rows.value.length - 1]?.id ?? '';
    }
  },
  { immediate: true }
);

function isRowStarted(row: MedicineRow): boolean {
  return Boolean(row.query || row.dose || row.frequency || row.durationDays || row.route || row.instructions);
}

function rowErrors(row: MedicineRow): string[] {
  if (!isRowStarted(row)) return [];
  const errs: string[] = [];
  if (!row.selectedFromSearch) errs.push('Select a medicine from suggestions.');
  if (!row.dose.trim()) errs.push('Dose is required.');
  if (!row.frequency.trim()) errs.push('Frequency is required.');
  if (!row.durationDays.trim() || Number(row.durationDays) <= 0) errs.push('Duration must be a positive number.');
  if (!row.route.trim()) errs.push('Route is required.');
  return errs;
}

function serializeRows(): string {
  const normalized = rows.value
    .filter((row) => isRowStarted(row))
    .map((row) => ({
      name: row.name.trim(),
      composition: row.composition.trim(),
      manufacturer: row.manufacturer.trim(),
      dose: row.dose.trim(),
      frequency: row.frequency.trim(),
      durationDays: row.durationDays.trim(),
      route: row.route.trim(),
      instructions: row.instructions.trim(),
      isDiscontinued: row.isDiscontinued ? true : undefined
    }));
  return JSON.stringify(normalized, null, 2);
}

function emitChange() {
  emit('action', { action: props.config?.change, payload: { value: serializeRows() } });
}

function focusRow(rowId: string) {
  editingRowId.value = rowId;
  activeRowId.value = rowId;
  const row = rows.value.find((entry) => entry.id === rowId);
  searchQuery.value = row?.query ?? '';
}

function updateQuery(row: MedicineRow, value: string) {
  row.query = value;
  row.name = value.trim();
  row.selectedFromSearch = false;
  row.composition = '';
  row.manufacturer = '';
  row.isDiscontinued = false;
  focusRow(row.id);
}

function pickSuggestion(row: MedicineRow, medicine: MedicineSearchResult) {
  row.query = medicine.name;
  row.name = medicine.name;
  row.composition = medicine.composition ?? '';
  row.manufacturer = medicine.manufacturer ?? '';
  row.selectedFromSearch = true;
  row.isDiscontinued = Boolean(medicine.is_discontinued);
  if (!row.frequency) row.frequency = 'BD';
  if (!row.durationDays) row.durationDays = '5';
  if (!row.route) row.route = 'Oral';
  activeRowId.value = '';
  searchQuery.value = '';
  emitChange();
}

function addRow(seed?: MedicineRow) {
  const row = emptyRow();
  if (seed) {
    row.query = seed.query;
    row.name = seed.name;
    row.composition = seed.composition;
    row.manufacturer = seed.manufacturer;
    row.selectedFromSearch = seed.selectedFromSearch;
    row.dose = seed.dose;
    row.frequency = seed.frequency;
    row.durationDays = seed.durationDays;
    row.route = seed.route;
    row.instructions = seed.instructions;
    row.isDiscontinued = seed.isDiscontinued;
  }
  rows.value.push(row);
  focusRow(row.id);
  showInstructionsForRowId.value = '';
  emitChange();
}

function appendNextRowFrom(index: number): void {
  const row = rows.value[index];
  if (!row) return;
  if (!isRowStarted(row)) {
    focusRow(row.id);
    return;
  }
  const errs = rowErrors(row);
  if (errs.length > 0) {
    forceShowErrorsForRowId.value = row.id;
    focusRow(row.id);
    return;
  }
  forceShowErrorsForRowId.value = '';
  addRow();
}

function deleteRow(index: number) {
  const removing = rows.value[index];
  rows.value.splice(index, 1);
  if (rows.value.length === 0) rows.value.push(emptyRow());
  if (removing && editingRowId.value === removing.id) {
    editingRowId.value = rows.value[Math.max(0, index - 1)]?.id ?? rows.value[0]?.id ?? '';
  }
  emitChange();
}

function onRowKeyDown(event: KeyboardEvent, index: number, row: MedicineRow) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'enter') {
    event.preventDefault();
    appendNextRowFrom(index);
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    addRow(row);
    return;
  }
  if (event.key === 'Tab' && !event.shiftKey) {
    const target = event.target as HTMLElement | null;
    if (target?.getAttribute('data-last-field') === 'true' && index === rows.value.length - 1) {
      appendNextRowFrom(index);
    }
  }
}

function summary(row: MedicineRow): string {
  const parts = [row.name, row.dose, row.frequency, row.durationDays ? `${row.durationDays} days` : '', row.route, row.instructions];
  return parts.filter((entry) => String(entry ?? '').trim().length > 0).join(' · ');
}

function beginEdit(index: number): void {
  const row = rows.value[index];
  if (!row) return;
  focusRow(row.id);
}

function setQuickFrequency(row: MedicineRow, value: string): void {
  row.frequency = value;
  emitChange();
}

function setQuickDuration(row: MedicineRow, value: string): void {
  row.durationDays = value;
  emitChange();
}
</script>

<template>
  <div :id="htmlId" :class="rootClass">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-semibold text-slate-800">Medicines *</p>
      <button
        type="button"
        class="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        @click="appendNextRowFrom(rows.length - 1)"
      >
        + Add medicine
      </button>
    </div>

    <div
      v-for="(row, index) in rows"
      :key="row.id"
      class="mb-3 rounded-md border border-slate-200 bg-slate-50/40 p-2 space-y-2 last:mb-0"
    >
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold text-slate-700">Rx {{ index + 1 }}</p>
        <div class="flex items-center gap-2">
          <button
            v-if="editingRowId !== row.id"
            type="button"
            class="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            @click="beginEdit(index)"
          >
            Edit
          </button>
          <button
            type="button"
            class="rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            @click="deleteRow(index)"
          >
            Delete
          </button>
        </div>
      </div>

      <template v-if="editingRowId === row.id">
        <div class="relative" @keydown="onRowKeyDown($event, index, row)">
          <label class="block text-[11px] font-semibold text-slate-700">Medicine</label>
          <input
            :value="row.query"
            type="text"
            class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Type at least 2 letters (e.g. Para...)"
            @focus="focusRow(row.id)"
            @input="updateQuery(row, ($event.target as HTMLInputElement).value); emitChange()"
          />
          <div v-if="isLoading && activeRowId === row.id" class="mt-1 text-[11px] text-slate-500">Searching...</div>
          <div
            v-if="activeRowId === row.id && searchQuery.trim().length >= 2"
            class="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg"
          >
            <button
              v-for="entry in visibleResults"
              :key="entry.id"
              type="button"
              class="block w-full rounded px-2 py-1 text-left text-[11px] hover:bg-slate-50"
              @mousedown.prevent="pickSuggestion(row, entry)"
            >
              <span class="font-semibold">{{ entry.name }}</span>
              <span class="text-slate-500"> · {{ entry.composition }} · {{ entry.manufacturer }}</span>
            </button>
            <p v-if="visibleResults.length === 0" class="px-2 py-1 text-[11px] text-slate-500">No medicines found.</p>
          </div>
        </div>
        <div class="pt-1">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            @click="appendNextRowFrom(index)"
          >
            + Add Medicine
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div @keydown="onRowKeyDown($event, index, row)">
            <label class="block text-[11px] font-semibold text-slate-700">Dose</label>
            <input
              v-model="row.dose"
              list="medicine-dose-options"
              type="text"
              class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="500 mg"
              @input="emitChange"
            />
          </div>

          <div @keydown="onRowKeyDown($event, index, row)">
            <label class="block text-[11px] font-semibold text-slate-700">Frequency</label>
            <select
              v-model="row.frequency"
              class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              @change="emitChange"
            >
              <option value="">Select</option>
              <option v-for="option in freqOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>

          <div @keydown="onRowKeyDown($event, index, row)">
            <label class="block text-[11px] font-semibold text-slate-700">Duration</label>
            <input
              v-model="row.durationDays"
              type="number"
              min="1"
              class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="days"
              @input="emitChange"
            />
          </div>

          <div @keydown="onRowKeyDown($event, index, row)">
            <label class="block text-[11px] font-semibold text-slate-700">Route</label>
            <select v-model="row.route" class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" @change="emitChange">
              <option value="">Select</option>
              <option v-for="option in routeOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1">
          <span class="text-[11px] text-slate-500">Quick frequency:</span>
          <button
            v-for="option in ['OD', 'BD', 'TDS']"
            :key="`freq-${option}`"
            type="button"
            class="rounded border px-1.5 py-0.5 text-[11px]"
            :class="row.frequency === option ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-700'"
            @click="setQuickFrequency(row, option)"
          >
            {{ option }}
          </button>
          <span class="ml-1 text-[11px] text-slate-500">days:</span>
          <button
            v-for="days in quickDurationOptions"
            :key="`dur-${days}`"
            type="button"
            class="rounded border px-1.5 py-0.5 text-[11px]"
            :class="
              row.durationDays === days ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-700'
            "
            @click="setQuickDuration(row, days)"
          >
            {{ days }}
          </button>
        </div>

        <div>
          <button
            type="button"
            class="text-[11px] font-semibold text-indigo-700 hover:text-indigo-800"
            @click="showInstructionsForRowId = showInstructionsForRowId === row.id ? '' : row.id"
          >
            {{ showInstructionsForRowId === row.id ? 'Hide instructions' : '+ Add instructions' }}
          </button>

          <div v-if="showInstructionsForRowId === row.id" class="mt-1" @keydown="onRowKeyDown($event, index, row)">
            <textarea
              v-model="row.instructions"
              data-last-field="true"
              rows="2"
              class="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="After food / Before bed"
              @input="emitChange"
            />
          </div>
        </div>

        <div class="space-y-1">
          <p v-if="row.isDiscontinued" class="text-[11px] font-semibold text-amber-700">
            Warning: selected medicine may be discontinued.
          </p>
          <p v-if="summary(row)" class="text-[11px] text-slate-500">{{ summary(row) }}</p>
        </div>

        <ul
          v-if="(isRowStarted(row) || forceShowErrorsForRowId === row.id) && rowErrors(row).length > 0"
          class="list-disc pl-5 text-[11px] text-rose-600"
        >
          <li v-for="entry in rowErrors(row)" :key="entry">{{ entry }}</li>
        </ul>
      </template>

      <p v-else-if="summary(row)" class="text-xs text-slate-600">{{ summary(row) }}</p>
      <p v-else class="text-xs text-slate-500">No details entered yet.</p>
    </div>

    <p class="text-[11px] text-slate-500">
      Shortcuts: Ctrl/Cmd + Enter add row · Ctrl/Cmd + D duplicate row · Tab from last field adds next row
    </p>
    <datalist id="medicine-dose-options">
      <option v-for="dose in commonDoseOptions" :key="dose" :value="dose" />
    </datalist>
  </div>
</template>
