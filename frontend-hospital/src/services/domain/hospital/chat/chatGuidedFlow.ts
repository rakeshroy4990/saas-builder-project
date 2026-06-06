import { isAxiosError } from 'axios';
import type { Composer } from 'vue-i18n';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { i18n } from '../../../../i18n';
import { pickString } from '../shared/strings';
import { ensureMedicalDepartmentOptionsLoaded, syncAppointmentDepartmentsFromMedicalStore } from '../shared/medicalDepartments';
import { ensureDoctorOptionsLoadedByDepartment } from '../shared/doctorCatalog';
import { refreshAppointmentDateAvailabilityFromForm } from '../shared/refreshAppointmentDateAvailability';
import { refreshAppointmentTimeSlotOptionsFromForm } from '../shared/refreshAppointmentTimeSlots';
import { loadDashboardAppointmentsPage } from '../shared/dashboardAppointments';
import { clearAppointmentPrescriptionFiles } from '../shared/appointmentPrescriptionFiles';
import {
  detectChatFeatureIntent,
  firstStepForIntent,
  getIntentDefinition,
  isGuidedFlowCancelMessage,
  nextStepForIntent,
  type ChatFeatureIntent,
  type GuidedFlowStep
} from './chatIntentMapping';

type HospitalAppStore = ReturnType<typeof useAppStore>;
type SelectOption = { id: string; label: string; value: string };

export type GuidedFlowState = {
  intent: ChatFeatureIntent;
  step: GuidedFlowStep;
  department?: string;
  departmentLabel?: string;
  doctorId?: string;
  doctorLabel?: string;
  ageGroup?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
};

export type GuidedFlowResult = {
  handled: boolean;
  reply?: string;
};

const flowTr = (): Composer['t'] => (i18n.global as Composer).t.bind(i18n.global as Composer);

function getGuidedFlow(chat: Record<string, unknown>): GuidedFlowState | null {
  const raw = chat.guidedFlow;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const intent = String(row.intent ?? '').trim() as ChatFeatureIntent;
  const step = String(row.step ?? '').trim() as GuidedFlowStep;
  if (!intent || !step) return null;
  return {
    intent,
    step,
    department: String(row.department ?? '').trim() || undefined,
    departmentLabel: String(row.departmentLabel ?? '').trim() || undefined,
    doctorId: String(row.doctorId ?? '').trim() || undefined,
    doctorLabel: String(row.doctorLabel ?? '').trim() || undefined,
    ageGroup: String(row.ageGroup ?? '').trim() || undefined,
    preferredDate: String(row.preferredDate ?? '').trim() || undefined,
    preferredTimeSlot: String(row.preferredTimeSlot ?? '').trim() || undefined
  };
}

function setGuidedFlow(appStore: HospitalAppStore, flow: GuidedFlowState | null): void {
  const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'Chat', {
    ...chat,
    guidedFlow: flow
  });
}

function formatNumberedOptions(options: SelectOption[]): string {
  return options.map((opt, idx) => `${idx + 1}. ${opt.label}`).join('\n');
}

function matchOptionIndex(message: string, options: SelectOption[]): number | null {
  const trimmed = String(message ?? '').trim();
  if (!trimmed || options.length === 0) return null;

  const asNumber = parseInt(trimmed, 10);
  if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= options.length) {
    return asNumber - 1;
  }

  const lower = trimmed.toLowerCase();
  for (let i = 0; i < options.length; i++) {
    const label = options[i].label.toLowerCase();
    const value = options[i].value.toLowerCase();
    if (lower === label || lower === value) return i;
    if (label.includes(lower) || lower.includes(label)) return i;
    if (value && (lower.includes(value) || value.includes(lower))) return i;
  }
  return null;
}

async function loadDepartmentOptions(): Promise<SelectOption[]> {
  await ensureMedicalDepartmentOptionsLoaded();
  const node = (useAppStore(pinia).getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
  const list = Array.isArray(node.list) ? (node.list as SelectOption[]) : [];
  return list.filter((row) => String(row.label ?? '').trim().length > 0);
}

async function loadDoctorOptions(department: string): Promise<SelectOption[]> {
  return ensureDoctorOptionsLoadedByDepartment(department);
}

function toIsoLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parsePreferredDate(message: string, availableDates: string[]): string | null {
  const trimmed = String(message ?? '').trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && availableDates.includes(trimmed)) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const today = toIsoLocalDate(new Date());
  if (lower === 'today' && availableDates.includes(today)) return today;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = toIsoLocalDate(tomorrow);
  if (lower === 'tomorrow' && availableDates.includes(tomorrowIso)) return tomorrowIso;

  for (const iso of availableDates) {
    const parts = iso.split('-');
    if (parts.length !== 3) continue;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase();
    if (lower.includes(label) || label.includes(lower)) return iso;
  }
  return null;
}

function parseAge(message: string): string | null {
  const digits = String(message ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const age = parseInt(digits, 10);
  if (Number.isNaN(age) || age < 1 || age > 20) return null;
  return String(age);
}

function isPatientAuthenticated(appStore: HospitalAppStore): boolean {
  const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  return Boolean(String(auth.userId ?? '').trim());
}

function syncAppointmentFormFromFlow(flow: GuidedFlowState): void {
  const appStore = useAppStore(pinia);
  const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  appStore.setProperty('hospital', 'AppointmentForm', 'editingAppointmentId', '');
  appStore.setProperty(
    'hospital',
    'AppointmentForm',
    'patientName',
    String(auth.fullName ?? auth.userDisplayName ?? '').trim()
  );
  appStore.setProperty('hospital', 'AppointmentForm', 'patientEmail', String(auth.email ?? '').trim());
  appStore.setProperty('hospital', 'AppointmentForm', 'patientPhone', String(auth.mobileNumber ?? '').trim());
  if (flow.department) appStore.setProperty('hospital', 'AppointmentForm', 'department', flow.department);
  if (flow.doctorId) appStore.setProperty('hospital', 'AppointmentForm', 'doctor', flow.doctorId);
  if (flow.ageGroup) appStore.setProperty('hospital', 'AppointmentForm', 'ageGroup', flow.ageGroup);
  if (flow.preferredDate) appStore.setProperty('hospital', 'AppointmentForm', 'preferredDate', flow.preferredDate);
  if (flow.preferredTimeSlot) {
    appStore.setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', flow.preferredTimeSlot);
  }
}

async function buildAvailabilitySummary(doctorId: string, doctorLabel: string): Promise<string> {
  syncAppointmentFormFromFlow({ intent: 'check_availability', step: 'show_availability', doctorId, doctorLabel });
  await refreshAppointmentDateAvailabilityFromForm();
  const node = (useAppStore(pinia).getData('hospital', 'AppointmentDateAvailability') ?? {}) as Record<string, unknown>;
  const slotCounts = Array.isArray(node.slotCounts)
    ? (node.slotCounts as Array<{ dateLabel: string; slotCount: number }>)
    : [];
  const available = slotCounts.filter((row) => row.slotCount > 0);
  if (available.length === 0) {
    return flowTr()('chat.intent.availability.none', { doctor: doctorLabel });
  }
  const lines = available.map((row) => `• ${row.dateLabel}: ${row.slotCount} ${flowTr()('chat.intent.slotsLabel')}`);
  return flowTr()('chat.intent.availability.summary', {
    doctor: doctorLabel,
    lines: lines.join('\n')
  });
}

async function submitAppointmentFromFlow(flow: GuidedFlowState): Promise<{ ok: boolean; message: string }> {
  syncAppointmentFormFromFlow(flow);
  const appStore = useAppStore(pinia);
  const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const form = (appStore.getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;

  const payload = {
    PatientName: pickString(form, ['patientName']) || pickString(auth, ['fullName', 'userDisplayName']),
    Email: pickString(form, ['patientEmail']) || pickString(auth, ['email']),
    PhoneNumber: pickString(form, ['patientPhone']) || pickString(auth, ['mobileNumber']),
    AgeGroup: pickString(form, ['ageGroup']),
    Department: pickString(form, ['department']),
    DoctorId: pickString(form, ['doctor']),
    PreferredDate: pickString(form, ['preferredDate']),
    PreferredTimeSlot: pickString(form, ['preferredTimeSlot']),
    AdditionalNotes: pickString(form, ['additionalNotes'])
  };

  try {
    const formData = new FormData();
    formData.append('appointment', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    await apiClient.post(URLRegistry.paths.appointmentCreate, formData);
    await loadDashboardAppointmentsPage();
    return { ok: true, message: flowTr()('chat.intent.booking.success') };
  } catch (error) {
    const message = isAxiosError(error)
      ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
        flowTr()('chat.intent.booking.failed')
      : flowTr()('chat.intent.booking.failed');
    return { ok: false, message };
  }
}

async function openAppointmentPopupStep2(flow: GuidedFlowState): Promise<void> {
  const appStore = useAppStore(pinia);
  await ensureMedicalDepartmentOptionsLoaded();
  syncAppointmentDepartmentsFromMedicalStore();

  syncAppointmentFormFromFlow(flow);
  appStore.setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
  appStore.setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
  appStore.setProperty('hospital', 'AppointmentForm', 'slotAvailabilityMessage', '');
  clearAppointmentPrescriptionFiles();
  appStore.setData('hospital', 'AppointmentTimeSlots', { list: [] });

  if (flow.department) {
    const doctors = await loadDoctorOptions(flow.department);
    appStore.setData('hospital', 'AppointmentDoctors', { list: doctors });
  }
  await refreshAppointmentDateAvailabilityFromForm();

  usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'appointment-popup', title: 'appointment' });
}

async function askDepartment(flow: GuidedFlowState): Promise<GuidedFlowResult> {
  const departments = await loadDepartmentOptions();
  if (departments.length === 0) {
    setGuidedFlow(useAppStore(pinia), null);
    return { handled: true, reply: flowTr()('chat.intent.departmentsUnavailable') };
  }
  return {
    handled: true,
    reply: flowTr()('chat.intent.askDepartment', { options: formatNumberedOptions(departments) })
  };
}

async function resolveDepartment(
  flow: GuidedFlowState,
  message: string
): Promise<{ flow: GuidedFlowState; reply: string } | { error: string }> {
  const departments = await loadDepartmentOptions();
  const idx = matchOptionIndex(message, departments);
  if (idx == null) {
    return {
      error: flowTr()('chat.intent.invalidDepartment', { options: formatNumberedOptions(departments) })
    };
  }
  const picked = departments[idx];
  const next: GuidedFlowState = {
    ...flow,
    step: 'doctor',
    department: picked.value,
    departmentLabel: picked.label
  };
  setGuidedFlow(useAppStore(pinia), next);
  return { flow: next, reply: await askDoctor(next) };
}

async function askDoctor(flow: GuidedFlowState): Promise<string> {
  if (!flow.department) return flowTr()('chat.intent.missingDepartment');
  const doctors = await loadDoctorOptions(flow.department);
  useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: doctors });
  if (doctors.length === 0) {
    setGuidedFlow(useAppStore(pinia), null);
    return flowTr()('chat.intent.doctorsUnavailable', { department: flow.departmentLabel ?? flow.department });
  }
  return flowTr()('chat.intent.askDoctor', {
    department: flow.departmentLabel ?? flow.department,
    options: formatNumberedOptions(doctors)
  });
}

async function resolveDoctor(
  flow: GuidedFlowState,
  message: string
): Promise<{ flow: GuidedFlowState; reply: string } | { error: string }> {
  if (!flow.department) return { error: flowTr()('chat.intent.missingDepartment') };
  const doctors = await loadDoctorOptions(flow.department);
  const idx = matchOptionIndex(message, doctors);
  if (idx == null) {
    return { error: flowTr()('chat.intent.invalidDoctor', { options: formatNumberedOptions(doctors) }) };
  }
  const picked = doctors[idx];
  const nextStep = nextStepForIntent(flow.intent, 'doctor');
  const next: GuidedFlowState = {
    ...flow,
    step: nextStep ?? 'complete',
    doctorId: picked.value,
    doctorLabel: picked.label
  };
  setGuidedFlow(useAppStore(pinia), next);
  return { flow: next, reply: await promptForStep(next) };
}

async function askAge(): Promise<string> {
  return flowTr()('chat.intent.askAge');
}

async function resolveAge(
  flow: GuidedFlowState,
  message: string
): Promise<{ flow: GuidedFlowState; reply: string } | { error: string }> {
  const age = parseAge(message);
  if (!age) return { error: flowTr()('chat.intent.invalidAge') };
  const next: GuidedFlowState = { ...flow, step: 'date', ageGroup: age };
  setGuidedFlow(useAppStore(pinia), next);
  return { flow: next, reply: await askDate(next) };
}

async function askDate(flow: GuidedFlowState): Promise<string> {
  syncAppointmentFormFromFlow(flow);
  await refreshAppointmentDateAvailabilityFromForm();
  const node = (useAppStore(pinia).getData('hospital', 'AppointmentDateAvailability') ?? {}) as Record<string, unknown>;
  const slotCounts = Array.isArray(node.slotCounts)
    ? (node.slotCounts as Array<{ date: string; dateLabel: string; slotCount: number }>)
    : [];
  const available = slotCounts.filter((row) => row.slotCount > 0);
  if (available.length === 0) {
    setGuidedFlow(useAppStore(pinia), null);
    return flowTr()('chat.intent.noDates', { doctor: flow.doctorLabel ?? '' });
  }
  const lines = available.map((row, idx) => `${idx + 1}. ${row.dateLabel} (${row.slotCount} slots) — ${row.date}`);
  return flowTr()('chat.intent.askDate', {
    doctor: flow.doctorLabel ?? '',
    options: lines.join('\n')
  });
}

async function resolveDate(
  flow: GuidedFlowState,
  message: string
): Promise<{ flow: GuidedFlowState; reply: string } | { error: string }> {
  syncAppointmentFormFromFlow(flow);
  await refreshAppointmentDateAvailabilityFromForm();
  const node = (useAppStore(pinia).getData('hospital', 'AppointmentDateAvailability') ?? {}) as Record<string, unknown>;
  const slotCounts = Array.isArray(node.slotCounts)
    ? (node.slotCounts as Array<{ date: string; dateLabel: string; slotCount: number }>)
    : [];
  const available = slotCounts.filter((row) => row.slotCount > 0);

  let pickedDate: string | null = null;
  const idx = matchOptionIndex(
    message,
    available.map((row) => ({ id: row.date, label: row.dateLabel, value: row.date }))
  );
  if (idx != null) {
    pickedDate = available[idx].date;
  } else {
    pickedDate = parsePreferredDate(message, available.map((row) => row.date));
  }
  if (!pickedDate) {
    const lines = available.map((row, i) => `${i + 1}. ${row.dateLabel} — ${row.date}`);
    return { error: flowTr()('chat.intent.invalidDate', { options: lines.join('\n') }) };
  }

  const next: GuidedFlowState = { ...flow, step: 'time_slot', preferredDate: pickedDate };
  setGuidedFlow(useAppStore(pinia), next);
  return { flow: next, reply: await askTimeSlot(next) };
}

async function askTimeSlot(flow: GuidedFlowState): Promise<string> {
  syncAppointmentFormFromFlow(flow);
  await refreshAppointmentTimeSlotOptionsFromForm();
  const node = (useAppStore(pinia).getData('hospital', 'AppointmentTimeSlots') ?? {}) as Record<string, unknown>;
  const slots = Array.isArray(node.list) ? (node.list as SelectOption[]) : [];
  if (slots.length === 0) {
    setGuidedFlow(useAppStore(pinia), null);
    return flowTr()('chat.intent.noTimeSlots', { date: flow.preferredDate ?? '' });
  }
  return flowTr()('chat.intent.askTimeSlot', { options: formatNumberedOptions(slots) });
}

async function resolveTimeSlot(
  flow: GuidedFlowState,
  message: string
): Promise<{ flow: GuidedFlowState; reply: string } | { error: string }> {
  syncAppointmentFormFromFlow(flow);
  await refreshAppointmentTimeSlotOptionsFromForm();
  const node = (useAppStore(pinia).getData('hospital', 'AppointmentTimeSlots') ?? {}) as Record<string, unknown>;
  const slots = Array.isArray(node.list) ? (node.list as SelectOption[]) : [];
  const idx = matchOptionIndex(message, slots);
  if (idx == null) {
    return { error: flowTr()('chat.intent.invalidTimeSlot', { options: formatNumberedOptions(slots) }) };
  }
  const next: GuidedFlowState = {
    ...flow,
    step: 'complete',
    preferredTimeSlot: slots[idx].value
  };
  setGuidedFlow(useAppStore(pinia), next);
  const result = await submitAppointmentFromFlow(next);
  setGuidedFlow(useAppStore(pinia), null);
  return { flow: next, reply: result.message };
}

async function completeAvailability(flow: GuidedFlowState): Promise<string> {
  if (!flow.doctorId) return flowTr()('chat.intent.missingDoctor');
  const summary = await buildAvailabilitySummary(flow.doctorId, flow.doctorLabel ?? flow.doctorId);
  setGuidedFlow(useAppStore(pinia), null);
  return summary;
}

async function completeVideoCall(flow: GuidedFlowState): Promise<string> {
  if (!flow.doctorId || !flow.department) {
    setGuidedFlow(useAppStore(pinia), null);
    return flowTr()('chat.intent.videoCall.incomplete');
  }
  const summary = await buildAvailabilitySummary(flow.doctorId, flow.doctorLabel ?? flow.doctorId);
  await openAppointmentPopupStep2(flow);
  setGuidedFlow(useAppStore(pinia), null);
  return `${summary}\n\n${flowTr()('chat.intent.videoCall.step2')}`;
}

async function promptForStep(flow: GuidedFlowState): Promise<string> {
  switch (flow.step) {
    case 'department':
      return (await askDepartment(flow)).reply ?? '';
    case 'doctor':
      return askDoctor(flow);
    case 'age':
      return askAge();
    case 'date':
      return askDate(flow);
    case 'time_slot':
      return askTimeSlot(flow);
    case 'show_availability':
      if (flow.intent === 'video_call') return completeVideoCall(flow);
      return completeAvailability(flow);
    case 'complete':
      setGuidedFlow(useAppStore(pinia), null);
      return flowTr()('chat.intent.flowComplete');
    default:
      setGuidedFlow(useAppStore(pinia), null);
      return flowTr()('chat.intent.flowComplete');
  }
}

async function processStepMessage(flow: GuidedFlowState, message: string): Promise<GuidedFlowResult> {
  if (isGuidedFlowCancelMessage(message)) {
    setGuidedFlow(useAppStore(pinia), null);
    return { handled: true, reply: flowTr()('chat.intent.cancelled') };
  }

  switch (flow.step) {
    case 'department': {
      const resolved = await resolveDepartment(flow, message);
      if ('error' in resolved) return { handled: true, reply: resolved.error };
      return { handled: true, reply: resolved.reply };
    }
    case 'doctor': {
      const resolved = await resolveDoctor(flow, message);
      if ('error' in resolved) return { handled: true, reply: resolved.error };
      return { handled: true, reply: resolved.reply };
    }
    case 'age': {
      const resolved = await resolveAge(flow, message);
      if ('error' in resolved) return { handled: true, reply: resolved.error };
      return { handled: true, reply: resolved.reply };
    }
    case 'date': {
      const resolved = await resolveDate(flow, message);
      if ('error' in resolved) return { handled: true, reply: resolved.error };
      return { handled: true, reply: resolved.reply };
    }
    case 'time_slot': {
      const resolved = await resolveTimeSlot(flow, message);
      if ('error' in resolved) return { handled: true, reply: resolved.error };
      return { handled: true, reply: resolved.reply };
    }
    default:
      return { handled: false };
  }
}

function startIntentReply(intent: ChatFeatureIntent): string {
  const key =
    intent === 'book_appointment'
      ? 'chat.intent.start.bookAppointment'
      : intent === 'check_availability'
        ? 'chat.intent.start.checkAvailability'
        : 'chat.intent.start.videoCall';
  return flowTr()(key);
}

/**
 * Handles guided feature flows in Smart AI chat. Returns handled=true when the message
 * was consumed by appointment / availability / video-call intent logic.
 */
export async function processChatGuidedFlow(
  appStore: HospitalAppStore,
  userMessage: string
): Promise<GuidedFlowResult> {
  const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
  const activeFlow = getGuidedFlow(chat);

  if (activeFlow) {
    return processStepMessage(activeFlow, userMessage);
  }

  const intent = detectChatFeatureIntent(userMessage);
  if (!intent) return { handled: false };

  if (!isPatientAuthenticated(appStore)) {
    return { handled: true, reply: flowTr()('chat.intent.loginRequired') };
  }

  const step = firstStepForIntent(intent);
  const flow: GuidedFlowState = { intent, step };
  setGuidedFlow(appStore, flow);

  const intro = startIntentReply(intent);
  const firstPrompt = await promptForStep(flow);
  return { handled: true, reply: `${intro}\n\n${firstPrompt}` };
}

export const __testOnlyChatGuidedFlow = {
  detectChatFeatureIntent,
  getIntentDefinition,
  matchOptionIndex,
  parseAge,
  parsePreferredDate
};
