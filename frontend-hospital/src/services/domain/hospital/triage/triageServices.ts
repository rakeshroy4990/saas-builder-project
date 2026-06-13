import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { postTriageAnalyzeNdjson } from '../../../http/triageAnalyzeStream';
import { fetchTriageForAppointmentId } from '../../../http/triageApi';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { ServiceRegistry } from '../../../../core/registry/ServiceRegistry';
import { openHospitalLoginPopup } from '../../../auth/hospitalLoginGate';
import { setDeferredPostLoginAction } from '../auth/postLoginAction';
import { i18n } from '../../../../i18n';
import { router } from '../../../../router';

const tr = (key: string): string => String((i18n.global as { t: (k: string) => string }).t(key));

export const TRIAGE_FREQUENCY_VALUES = [
  'CONSTANT',
  'FEW_TIMES_PER_DAY',
  'ONCE_PER_DAY',
  'INTERMITTENT'
] as const;

export type TriageFrequency = (typeof TRIAGE_FREQUENCY_VALUES)[number];
export type TriageDurationUnit = 'hours' | 'days';

async function openTriagePage(requestData?: Record<string, unknown>): Promise<void> {
  const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const userId = String(authSession.userId ?? '').trim();
  if (!userId) {
    setDeferredPostLoginAction({
      packageName: 'hospital',
      actionId: 'open-triage-page',
      data: requestData ?? {}
    });
    openHospitalLoginPopup(tr('appointment.loginRequired'));
    return;
  }

  const appointmentId = String(requestData?.appointmentId ?? '').trim();
  sessionStore().set({ ...defaultSession(), appointmentId, step: 'form' });
  await router.push('/triage');
}

async function runHospitalService(serviceId: string, data: Record<string, unknown> = {}): Promise<unknown> {
  const svc = ServiceRegistry.getInstance().get('hospital', serviceId);
  if (!svc) {
    throw new Error(`Service not registered: hospital::${serviceId}`);
  }
  return svc.execute({ data });
}

export interface TriageSessionState {
  step: 'form' | 'loading' | 'result';
  childDisplayName: string;
  childAgeMonths: number | null;
  childWeightKg: number | null;
  reportedSymptoms: string[];
  symptomFrequency: TriageFrequency | '';
  symptomBrief: string;
  symptomDurationAmount: number | null;
  symptomDurationUnit: TriageDurationUnit;
  symptomDurationHours: number | null;
  symptomSeverity: 'MILD' | 'MODERATE' | 'SEVERE';
  additionalNotes: string;
  appointmentId: string;
  streamPhase: string;
  streamPreview: string;
  externalId: string;
  urgencyLevel: string;
  urgencyReasoning: string;
  doctorNote: string;
  redFlags: string[];
}

function defaultSession(): TriageSessionState {
  return {
    step: 'form',
    childDisplayName: '',
    childAgeMonths: null,
    childWeightKg: null,
    reportedSymptoms: [],
    symptomFrequency: '',
    symptomBrief: '',
    symptomDurationAmount: null,
    symptomDurationUnit: 'hours',
    symptomDurationHours: null,
    symptomSeverity: 'MILD',
    additionalNotes: '',
    appointmentId: '',
    streamPhase: '',
    streamPreview: '',
    externalId: '',
    urgencyLevel: '',
    urgencyReasoning: '',
    doctorNote: '',
    redFlags: []
  };
}

function sessionStore() {
  const appStore = useAppStore(pinia);
  return {
    get(): TriageSessionState {
      const current = (appStore.getData('hospital', 'TriageSession') ?? {}) as Partial<TriageSessionState>;
      return { ...defaultSession(), ...current };
    },
    set(patch: Partial<TriageSessionState>) {
      const current = (appStore.getData('hospital', 'TriageSession') ?? {}) as Partial<TriageSessionState>;
      appStore.setData('hospital', 'TriageSession', { ...defaultSession(), ...current, ...patch });
    },
    reset() {
      appStore.setData('hospital', 'TriageSession', defaultSession());
    }
  };
}

function parseSymptomInput(text: string): string[] {
  return text
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeReportedSymptoms(raw: Partial<TriageSessionState> & { symptomText?: string }): string[] {
  const fromList = Array.isArray(raw.reportedSymptoms)
    ? raw.reportedSymptoms.map((item) => String(item).trim()).filter(Boolean)
    : [];
  if (fromList.length) return fromList.slice(0, 20);
  return parseSymptomInput(String(raw.symptomText ?? ''));
}

function isTriageFrequency(value: string): value is TriageFrequency {
  return (TRIAGE_FREQUENCY_VALUES as readonly string[]).includes(value);
}

function resolveDurationHours(amount: number | null | undefined, unit: TriageDurationUnit): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return unit === 'days' ? Math.round(amount * 24) : Math.round(amount);
}

function buildAnalyzeNotes(frequency: TriageFrequency, symptomBrief?: string): string {
  const parts = [`${tr('triage.frequency.notePrefix')}: ${tr(`triage.frequency.${frequency}`)}`];
  const brief = String(symptomBrief ?? '').trim();
  if (brief) {
    parts.push(`${tr('triage.symptomBrief.notePrefix')}: ${brief.slice(0, 500)}`);
  }
  return parts.join('\n');
}

const TRIAGE_STREAM_PHASE_RANK: Record<string, number> = {
  accepted: 1,
  retrieving: 2,
  hyde_hypothesis: 3,
  retrieving_docs: 4,
  generating: 5
};

function createTriageStreamUi(store: ReturnType<typeof sessionStore>) {
  let preview = '';
  let phase = '';
  let paintQueued = false;

  const flush = (): void => {
    paintQueued = false;
    const patch: Partial<TriageSessionState> = { streamPreview: preview };
    if (phase) patch.streamPhase = phase;
    store.set(patch);
  };

  const schedulePaint = (): void => {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(flush);
  };

  const applyPhase = (next: string): void => {
    const normalized = String(next ?? '').trim();
    if (!normalized || normalized === 'processing') return;
    const current = store.get().streamPhase;
    const curRank = TRIAGE_STREAM_PHASE_RANK[current] ?? 0;
    const nextRank = TRIAGE_STREAM_PHASE_RANK[normalized] ?? 0;
    if (nextRank > curRank || (nextRank === curRank && normalized !== current)) {
      phase = normalized;
      schedulePaint();
    }
  };

  return {
    onReady: () => applyPhase('accepted'),
    onStatus: (next: string) => applyPhase(next),
    onDelta: (chunk: string) => {
      if (!chunk) return;
      preview += chunk;
      if ((TRIAGE_STREAM_PHASE_RANK[phase] ?? 0) < TRIAGE_STREAM_PHASE_RANK.generating) {
        phase = 'generating';
      }
      schedulePaint();
    },
    flushNow: () => {
      if (!paintQueued) return;
      paintQueued = false;
      flush();
    }
  };
}

export const triageHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-triage-page',
    execute: async (request) => {
      await openTriagePage((request.data ?? {}) as Record<string, unknown>);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-triage-popup',
    execute: async (request) => {
      await openTriagePage((request.data ?? {}) as Record<string, unknown>);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'init-triage-page',
    execute: async () => {
      const s = sessionStore().get();
      if (s.step === 'result' && s.externalId) {
        return ok();
      }
      if (!['form', 'loading', 'result', 'profile', 'symptoms'].includes(s.step)) {
        sessionStore().set({ ...defaultSession(), appointmentId: s.appointmentId, step: 'form' });
      }
      if (s.step === 'profile' || s.step === 'symptoms') {
        sessionStore().set({ step: 'form' });
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'triage-restart-checker',
    execute: async () => {
      const s = sessionStore().get();
      sessionStore().set({ ...defaultSession(), appointmentId: s.appointmentId, step: 'form' });
      await router.push('/triage');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-triage-soft-block-popup',
    execute: async (request) => {
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      useAppStore(pinia).setData('hospital', 'TriageSoftBlock', {
        appointmentId,
        resumeActionId: String(request.data?.resumeActionId ?? 'open-appointment-video-call'),
        resumeData: request.data?.resumeData ?? {}
      });
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'triage-soft-block-popup', title: 'triage.softBlockTitle' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'triage-submit-analyze',
    execute: async () => {
      const store = sessionStore();
      const raw = (useAppStore(pinia).getData('hospital', 'TriageSession') ?? {}) as Partial<TriageSessionState> & {
        symptomText?: string;
      };
      const reportedSymptoms = normalizeReportedSymptoms(raw);
      const s = { ...store.get(), reportedSymptoms };
      const frequency = String(s.symptomFrequency ?? '').trim();
      if (!s.childAgeMonths || s.childAgeMonths < 0) {
        useToastStore(pinia).show(tr('triage.errors.ageRequired'), 'error');
        return { responseCode: 'TRIAGE_INVALID', message: 'age required' };
      }
      if (!reportedSymptoms.length) {
        useToastStore(pinia).show(tr('triage.errors.symptomRequired'), 'error');
        return { responseCode: 'TRIAGE_INVALID', message: 'symptoms required' };
      }
      if (!isTriageFrequency(frequency)) {
        useToastStore(pinia).show(tr('triage.errors.frequencyRequired'), 'error');
        return { responseCode: 'TRIAGE_INVALID', message: 'frequency required' };
      }
      store.set({ ...s, reportedSymptoms, step: 'loading', streamPhase: '', streamPreview: '' });
      const streamUi = createTriageStreamUi(store);
      try {
        const row = await postTriageAnalyzeNdjson(
          {
            ChildDisplayName: s.childDisplayName || undefined,
            ChildAgeMonths: s.childAgeMonths,
            ChildWeightKg: s.childWeightKg ?? undefined,
            ReportedSymptoms: s.reportedSymptoms,
            SymptomSeverity: s.symptomSeverity,
            AdditionalNotes: buildAnalyzeNotes(frequency, s.symptomBrief)
          },
          {
            onReady: streamUi.onReady,
            onStatus: streamUi.onStatus,
            onDelta: streamUi.onDelta
          }
        );
        streamUi.flushNow();
        store.set({
          step: 'result',
          streamPhase: '',
          streamPreview: '',
          externalId: row.externalId,
          urgencyLevel: row.urgencyLevel,
          urgencyReasoning: row.urgencyReasoning,
          doctorNote: row.doctorNote,
          redFlags: row.redFlags
        });
        return ok(row);
      } catch (err: unknown) {
        store.set({ step: 'form', streamPhase: '', streamPreview: '' });
        const message = err instanceof Error ? err.message : 'Triage failed';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'TRIAGE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'triage-book-appointment',
    execute: async () => {
      const s = sessionStore().get();
      const appStore = useAppStore(pinia);
      const existing = (appStore.getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;
      const notes = s.doctorNote ? `[Pre-consultation triage]\n${s.doctorNote}` : '';
      appStore.setData('hospital', 'AppointmentForm', {
        ...existing,
        additionalNotes: notes,
        triageResultExternalId: s.externalId
      });
      await runHospitalService('open-appointment-popup');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'triage-soft-block-continue',
    execute: async () => {
      const block = (useAppStore(pinia).getData('hospital', 'TriageSoftBlock') ?? {}) as Record<string, unknown>;
      const actionId = String(block.resumeActionId ?? 'open-appointment-video-call');
      const resumeData = (block.resumeData ?? {}) as Record<string, unknown>;
      usePopupStore(pinia).close();
      await runHospitalService(actionId, resumeData);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'triage-check-before-video-call',
    execute: async (request) => {
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      const role = String(
        pickString((useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>, [
          'role',
          'Role'
        ])
      ).toUpperCase();
      if (role !== 'PATIENT' || !appointmentId) {
        return ok({ skip: true });
      }
      const latest = await fetchTriageForAppointmentId(appointmentId);
      if (latest?.createdAt) {
        const ageMs = Date.now() - new Date(latest.createdAt).getTime();
        if (ageMs < 24 * 60 * 60 * 1000) {
          return ok({ fresh: true });
        }
      }
      await runHospitalService('open-triage-soft-block-popup', {
        appointmentId,
        resumeActionId: 'open-appointment-video-call',
        resumeData: request.data ?? {}
      });
      return ok({ blocked: true });
    }
  }
];
