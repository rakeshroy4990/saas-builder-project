import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import {
  fetchGrowthChartContext,
  listChildProfiles,
  saveChildProfile,
  saveGrowthRecord,
  type ChildProfileRow,
  type GrowthChartContext,
  type GrowthMetric
} from '../../../http/growthApi';
import { pickString } from '../shared/strings';
import { ok } from '../shared/response';

export interface GrowthSessionState {
  loading: boolean;
  children: ChildProfileRow[];
  selectedChildId: string;
  metric: GrowthMetric;
  chart: GrowthChartContext | null;
  showAddChild: boolean;
  newChildName: string;
  newChildDob: string;
  newChildSex: 'male' | 'female';
  entryHeightCm: string;
  entryWeightKg: string;
  entryHcCm: string;
  entryRecordedDate: string;
}

function todayDateInput(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function defaultGrowthSession(): GrowthSessionState {
  return {
    loading: false,
    children: [],
    selectedChildId: '',
    metric: 'wfa',
    chart: null,
    showAddChild: false,
    newChildName: '',
    newChildDob: '',
    newChildSex: 'male',
    entryHeightCm: '',
    entryWeightKg: '',
    entryHcCm: '',
    entryRecordedDate: todayDateInput()
  };
}

function growthStore() {
  return useAppStore(pinia);
}

function session(): GrowthSessionState {
  const raw = (growthStore().getData('hospital', 'GrowthSession') ?? {}) as Partial<GrowthSessionState>;
  return { ...defaultGrowthSession(), ...raw };
}

function setSession(patch: Partial<GrowthSessionState>): void {
  growthStore().setData('hospital', 'GrowthSession', { ...session(), ...patch });
}

async function loadGrowthWorkspace(): Promise<unknown> {
  const current = session();
  if (!current.entryRecordedDate.trim()) {
    setSession({ entryRecordedDate: todayDateInput() });
  }
  setSession({ loading: true });
  try {
    const children = await listChildProfiles();
    const selectedChildId = session().selectedChildId || children[0]?.externalId || '';
    setSession({ children, selectedChildId, loading: false });
    if (selectedChildId) {
      await refreshGrowthChart();
    }
    return ok('growth.loaded');
  } catch (err) {
    setSession({ loading: false });
    const message = pickString((err as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {}, ['Message']);
    useToastStore(pinia).show(message || 'Failed to load growth data', 'error');
    throw err;
  }
}

async function refreshGrowthChart(): Promise<unknown> {
  const childId = session().selectedChildId;
  if (!childId) return ok('growth.no_child');
  setSession({ loading: true });
  try {
    const chart = await fetchGrowthChartContext(childId, session().metric);
    setSession({ chart, loading: false });
    return ok('growth.chart.loaded');
  } catch (err) {
    setSession({ loading: false });
    throw err;
  }
}

async function setGrowthMetric(data: Record<string, unknown>): Promise<unknown> {
  const metric = String(data.metric ?? session().metric).trim() as GrowthMetric;
  setSession({ metric });
  return refreshGrowthChart();
}

async function selectGrowthChild(data: Record<string, unknown>): Promise<unknown> {
  const childId = String(data.childId ?? '').trim();
  setSession({ selectedChildId: childId });
  return refreshGrowthChart();
}

async function toggleAddChildForm(): Promise<unknown> {
  setSession({ showAddChild: !session().showAddChild });
  return ok('growth.toggle_add_child');
}

async function saveNewChildProfile(): Promise<unknown> {
  const s = session();
  if (!s.newChildName.trim() || !s.newChildDob.trim()) {
    useToastStore(pinia).show('Name and date of birth are required', 'error');
    return ok('growth.child.invalid');
  }
  setSession({ loading: true });
  try {
    const saved = await saveChildProfile({
      displayName: s.newChildName.trim(),
      dateOfBirth: s.newChildDob.trim(),
      sex: s.newChildSex
    });
    const children = await listChildProfiles();
    setSession({
      children,
      selectedChildId: saved.externalId,
      showAddChild: false,
      newChildName: '',
      newChildDob: '',
      loading: false
    });
    await refreshGrowthChart();
    useToastStore(pinia).show('Child profile saved', 'success');
    return ok('growth.child.saved');
  } catch (err) {
    setSession({ loading: false });
    const message = pickString((err as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {}, ['Message']);
    useToastStore(pinia).show(message || 'Failed to save child profile', 'error');
    throw err;
  }
}

async function saveManualGrowthReading(): Promise<unknown> {
  const s = session();
  if (!s.selectedChildId) {
    useToastStore(pinia).show('Select a child first', 'error');
    return ok('growth.no_child');
  }
  const weightKg = s.entryWeightKg.trim() ? Number(s.entryWeightKg) : null;
  const heightCm = s.entryHeightCm.trim() ? Number(s.entryHeightCm) : null;
  const headCircumferenceCm = s.entryHcCm.trim() ? Number(s.entryHcCm) : null;
  if (weightKg == null && heightCm == null && headCircumferenceCm == null) {
    useToastStore(pinia).show('Enter at least one measurement', 'error');
    return ok('growth.entry.invalid');
  }

  const recordedDate = s.entryRecordedDate.trim() || todayDateInput();
  const child = s.children.find((row) => row.externalId === s.selectedChildId);
  if (recordedDate > todayDateInput()) {
    useToastStore(pinia).show('Measurement date cannot be in the future', 'error');
    return ok('growth.entry.date_future');
  }
  if (child?.dateOfBirth && recordedDate < child.dateOfBirth) {
    useToastStore(pinia).show('Measurement date cannot be before the child\'s date of birth', 'error');
    return ok('growth.entry.date_before_dob');
  }

  setSession({ loading: true });
  try {
    await saveGrowthRecord({
      childProfileExternalId: s.selectedChildId,
      recordedAt: `${recordedDate}T12:00:00.000Z`,
      weightKg,
      heightCm,
      headCircumferenceCm,
      source: 'manual'
    });
    setSession({
      entryHeightCm: '',
      entryWeightKg: '',
      entryHcCm: '',
      entryRecordedDate: todayDateInput(),
      loading: false
    });
    await refreshGrowthChart();
    useToastStore(pinia).show('Growth reading saved', 'success');
    return ok('growth.record.saved');
  } catch (err) {
    setSession({ loading: false });
    const message = pickString((err as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {}, ['Message']);
    useToastStore(pinia).show(message || 'Failed to save reading', 'error');
    throw err;
  }
}

async function patchGrowthSession(data: Record<string, unknown>): Promise<unknown> {
  const patch: Partial<GrowthSessionState> = {};
  for (const key of [
    'newChildName',
    'newChildDob',
    'newChildSex',
    'entryHeightCm',
    'entryWeightKg',
    'entryHcCm',
    'entryRecordedDate'
  ] as const) {
    if (data[key] != null) {
      patch[key] = String(data[key]) as GrowthSessionState[typeof key];
    }
  }
  setSession(patch);
  return ok('growth.session.patched');
}

export const growthHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-growth-workspace',
    execute: async () => loadGrowthWorkspace()
  },
  {
    packageName: 'hospital',
    serviceId: 'refresh-growth-chart',
    execute: async () => refreshGrowthChart()
  },
  {
    packageName: 'hospital',
    serviceId: 'set-growth-metric',
    execute: async ({ data }) => setGrowthMetric(data ?? {})
  },
  {
    packageName: 'hospital',
    serviceId: 'select-growth-child',
    execute: async ({ data }) => selectGrowthChild(data ?? {})
  },
  {
    packageName: 'hospital',
    serviceId: 'toggle-add-child-form',
    execute: async () => toggleAddChildForm()
  },
  {
    packageName: 'hospital',
    serviceId: 'save-new-child-profile',
    execute: async () => saveNewChildProfile()
  },
  {
    packageName: 'hospital',
    serviceId: 'save-manual-growth-reading',
    execute: async () => saveManualGrowthReading()
  },
  {
    packageName: 'hospital',
    serviceId: 'patch-growth-session',
    execute: async ({ data }) => patchGrowthSession(data ?? {})
  }
];
