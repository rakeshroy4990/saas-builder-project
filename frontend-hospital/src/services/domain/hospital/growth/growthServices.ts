import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import {
  fetchGrowthChartContext,
  listChildProfiles,
  saveChildProfile,
  saveGrowthRecord,
  parseChildProfileRow,
  coalesceParentHeights,
  formatParentHeightInput,
  type ChildProfileRow,
  type GrowthChartContext,
  type GrowthMetric
} from '../../../http/growthApi';
import { pickString } from '../shared/strings';
import { ok } from '../shared/response';
import { ServiceRegistry } from '../../../../core/registry/ServiceRegistry';
import { openHospitalLoginPopup } from '../../../auth/hospitalLoginGate';
import { setDeferredPostLoginAction } from '../auth/postLoginAction';
import { i18n } from '../../../../i18n';
import { router } from '../../../../router';

const tr = (key: string): string => String((i18n.global as { t: (k: string) => string }).t(key));

async function runHospitalService(serviceId: string, data: Record<string, unknown> = {}): Promise<void> {
  const svc = ServiceRegistry.getInstance().get('hospital', serviceId);
  if (!svc) {
    throw new Error(`Service not registered: hospital::${serviceId}`);
  }
  await svc.execute({ data });
}

async function openGrowthPage(): Promise<void> {
  const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const userId = String(authSession.userId ?? '').trim();
  const role = String(authSession.role ?? '').trim().toUpperCase();
  if (!userId) {
    setDeferredPostLoginAction({
      packageName: 'hospital',
      actionId: 'resume-dashboard-nav-after-login',
      data: { tab: 'growth' }
    });
    openHospitalLoginPopup(tr('appointment.loginRequired'));
    return;
  }
  if (role !== 'PATIENT') {
    useToastStore(pinia).show(tr('growth.patientOnly'), 'error');
    return;
  }
  await runHospitalService('set-dashboard-nav-growth', { preserveOnInit: true });
  await runHospitalService('init-growth-workspace');
  await runHospitalService('set-dashboard-header-active');
  const currentPath = String(router.currentRoute.value.path ?? '').trim();
  if (currentPath !== '/dashboard') {
    await router.push('/dashboard');
  }
}

export interface GrowthSessionState {
  loading: boolean;
  children: ChildProfileRow[];
  selectedChildId: string;
  metric: GrowthMetric;
  chart: GrowthChartContext | null;
  showAddChild: boolean;
  editingChildId: string;
  newChildName: string;
  newChildDob: string;
  newChildSex: 'male' | 'female';
  newMotherHeightCm: string;
  newFatherHeightCm: string;
  entryHeightCm: string;
  entryWeightKg: string;
  entryHcCm: string;
  entryRecordedDate: string;
  editingRecordId: string;
}

function todayDateInput(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function isoToDateInput(iso: string): string {
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (!trimmed) return todayDateInput();
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return todayDateInput();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

function clearEntryFields(): Partial<GrowthSessionState> {
  return {
    editingRecordId: '',
    entryHeightCm: '',
    entryWeightKg: '',
    entryHcCm: '',
    entryRecordedDate: todayDateInput()
  };
}

function clearChildFormFields(): Partial<GrowthSessionState> {
  return {
    showAddChild: false,
    editingChildId: '',
    newChildName: '',
    newChildDob: '',
    newChildSex: 'male',
    newMotherHeightCm: '',
    newFatherHeightCm: ''
  };
}

function defaultGrowthSession(): GrowthSessionState {
  return {
    loading: false,
    children: [],
    selectedChildId: '',
    metric: 'wfa',
    chart: null,
    showAddChild: false,
    editingChildId: '',
    newChildName: '',
    newChildDob: '',
    newChildSex: 'male',
    newMotherHeightCm: '',
    newFatherHeightCm: '',
    entryHeightCm: '',
    entryWeightKg: '',
    entryHcCm: '',
    entryRecordedDate: todayDateInput(),
    editingRecordId: ''
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

function mergeChildProfileRow(children: ChildProfileRow[], updated: ChildProfileRow): ChildProfileRow[] {
  if (!updated.externalId) return children;
  const index = children.findIndex((row) => {
    const id = parseChildProfileRow(row)?.externalId ?? row.externalId;
    return id === updated.externalId;
  });
  if (index < 0) return [...children, updated];
  const next = [...children];
  next[index] = { ...parseChildProfileRow(next[index]) ?? next[index], ...updated };
  return next;
}

function resolveChildForEdit(childId: string): ChildProfileRow | null {
  const s = session();
  const fromList =
    s.children
      .map((row) => parseChildProfileRow(row))
      .find((child) => child?.externalId === childId) ?? null;
  const chart = s.chart;
  const fromChart = chart?.childProfile ? parseChildProfileRow(chart.childProfile) : null;
  const mph = chart?.midParentalHeight ?? null;

  if (!fromList && !fromChart) return null;

  const merged = !fromChart
    ? fromList
    : !fromList
      ? fromChart
      : {
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

  if (!merged) return null;
  return { ...merged, ...coalesceParentHeights(merged, mph) };
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
    const children = chart.childProfile?.externalId
      ? mergeChildProfileRow(session().children, chart.childProfile)
      : session().children;
    setSession({ chart, children, loading: false });
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
  setSession({ selectedChildId: childId, ...clearEntryFields(), ...clearChildFormFields() });
  return refreshGrowthChart();
}

async function startAddChildForm(): Promise<unknown> {
  setSession({
    showAddChild: true,
    editingChildId: '',
    newChildName: '',
    newChildDob: '',
    newChildSex: 'male',
    newMotherHeightCm: '',
    newFatherHeightCm: ''
  });
  return ok('growth.add_child.started');
}

async function startEditChildProfile(): Promise<unknown> {
  const s = session();
  const child = resolveChildForEdit(s.selectedChildId);
  if (!child) {
    useToastStore(pinia).show('Select a child first', 'error');
    return ok('growth.no_child');
  }
  setSession({
    showAddChild: true,
    editingChildId: child.externalId,
    newChildName: child.displayName,
    newChildDob: isoToDateInput(child.dateOfBirth),
    newChildSex: child.sex === 'female' ? 'female' : 'male',
    newMotherHeightCm: formatParentHeightInput(child.motherHeightCm),
    newFatherHeightCm: formatParentHeightInput(child.fatherHeightCm)
  });
  return ok('growth.edit_child.started');
}

async function cancelChildForm(): Promise<unknown> {
  setSession(clearChildFormFields());
  return ok('growth.child_form.cancelled');
}

async function saveNewChildProfile(): Promise<unknown> {
  const s = session();
  if (!s.newChildName.trim() || !s.newChildDob.trim()) {
    useToastStore(pinia).show('Name and date of birth are required', 'error');
    return ok('growth.child.invalid');
  }
  setSession({ loading: true });
  try {
    const editingChildId = s.editingChildId.trim();
    const motherHeight = s.newMotherHeightCm.trim() ? Number(s.newMotherHeightCm) : null;
    const fatherHeight = s.newFatherHeightCm.trim() ? Number(s.newFatherHeightCm) : null;
    if (motherHeight != null && (!Number.isFinite(motherHeight) || motherHeight < 100 || motherHeight > 250)) {
      useToastStore(pinia).show(tr('growth.parentHeightInvalid'), 'error');
      setSession({ loading: false });
      return ok('growth.child.parent_height_invalid');
    }
    if (fatherHeight != null && (!Number.isFinite(fatherHeight) || fatherHeight < 100 || fatherHeight > 250)) {
      useToastStore(pinia).show(tr('growth.parentHeightInvalid'), 'error');
      setSession({ loading: false });
      return ok('growth.child.parent_height_invalid');
    }
    const saved = await saveChildProfile({
      externalId: editingChildId || undefined,
      displayName: s.newChildName.trim(),
      dateOfBirth: s.newChildDob.trim(),
      sex: s.newChildSex,
      motherHeightCm: motherHeight,
      fatherHeightCm: fatherHeight
    });
    const childrenFromList = await listChildProfiles();
    const children = mergeChildProfileRow(childrenFromList, saved);
    const geneticHeightsSaved = motherHeight != null && fatherHeight != null;
    setSession({
      children,
      selectedChildId: saved.externalId,
      ...(geneticHeightsSaved ? { metric: 'lhfa' as GrowthMetric } : {}),
      ...clearChildFormFields(),
      loading: false
    });
    await refreshGrowthChart();
    useToastStore(pinia).show(
      editingChildId ? 'Child profile updated' : 'Child profile saved',
      'success'
    );
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

  const editingRecordId = s.editingRecordId.trim();
  setSession({ loading: true });
  try {
    await saveGrowthRecord({
      externalId: editingRecordId || undefined,
      childProfileExternalId: s.selectedChildId,
      recordedAt: `${recordedDate}T12:00:00.000Z`,
      weightKg,
      heightCm,
      headCircumferenceCm,
      source: 'manual'
    });
    setSession({ ...clearEntryFields(), loading: false });
    await refreshGrowthChart();
    useToastStore(pinia).show(
      editingRecordId ? 'Growth reading updated' : 'Growth reading saved',
      'success'
    );
    return ok(editingRecordId ? 'growth.record.updated' : 'growth.record.saved');
  } catch (err) {
    setSession({ loading: false });
    const message = pickString((err as { response?: { data?: Record<string, unknown> } })?.response?.data ?? {}, ['Message']);
    useToastStore(pinia).show(message || 'Failed to save reading', 'error');
    throw err;
  }
}

async function startEditGrowthRecord(data: Record<string, unknown>): Promise<unknown> {
  const externalId = String(data.externalId ?? '').trim();
  if (!externalId) {
    return ok('growth.edit.invalid');
  }
  setSession({
    editingRecordId: externalId,
    entryHeightCm: data.heightCm != null && data.heightCm !== '' ? String(data.heightCm) : '',
    entryWeightKg: data.weightKg != null && data.weightKg !== '' ? String(data.weightKg) : '',
    entryHcCm:
      data.headCircumferenceCm != null && data.headCircumferenceCm !== ''
        ? String(data.headCircumferenceCm)
        : '',
    entryRecordedDate: isoToDateInput(String(data.recordedAt ?? ''))
  });
  return ok('growth.edit.started');
}

async function cancelEditGrowthRecord(): Promise<unknown> {
  setSession(clearEntryFields());
  return ok('growth.edit.cancelled');
}

async function patchGrowthSession(data: Record<string, unknown>): Promise<unknown> {
  const patch: Partial<GrowthSessionState> = {};
  for (const key of [
    'newChildName',
    'newChildDob',
    'newChildSex',
    'newMotherHeightCm',
    'newFatherHeightCm',
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
    serviceId: 'open-growth-page',
    execute: async () => {
      await openGrowthPage();
      return ok();
    }
  },
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
    serviceId: 'start-add-child-form',
    execute: async () => startAddChildForm()
  },
  {
    packageName: 'hospital',
    serviceId: 'start-edit-child-profile',
    execute: async () => startEditChildProfile()
  },
  {
    packageName: 'hospital',
    serviceId: 'cancel-child-form',
    execute: async () => cancelChildForm()
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
  },
  {
    packageName: 'hospital',
    serviceId: 'start-edit-growth-record',
    execute: async ({ data }) => startEditGrowthRecord(data ?? {})
  },
  {
    packageName: 'hospital',
    serviceId: 'cancel-edit-growth-record',
    execute: async () => cancelEditGrowthRecord()
  }
];
