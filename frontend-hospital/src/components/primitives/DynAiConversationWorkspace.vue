<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import {
  analyzeAiConversation,
  generateAiConversationSummary,
  saveAiConversation,
  startAiConversation,
  transcribeAiConversation,
  uploadAiConversationAudio,
  uploadAiConversationChunkKeepalive,
  type AiConversationSession,
  type AiConversationTurn
} from '../../services/http/aiConversationApi';

/** Flush MediaRecorder slices to the server so a closed tab still leaves recoverable audio. */
const CHUNK_FLUSH_MS = 15_000;

type Phase = 'idle' | 'recording' | 'paused' | 'processing' | 'review' | 'saved';
type TabId = 'transcript' | 'summary' | 'soap' | 'diagnosis';
type AppointmentOption = { id: string; label: string; value: string };

const { t } = useI18n();
const appStore = useAppStore(pinia);

const phase = ref<Phase>('idle');
const tab = ref<TabId>('transcript');
const error = ref('');
const statusLine = ref('');
const elapsedSec = ref(0);
const swapSpeakers = ref(false);
const starting = ref(false);

const selectedAppointmentId = ref('');
const languageHint = ref('mixed');
const consent = ref(false);

const sessionId = ref('');
const appointmentId = ref('');
const transcriptText = ref('');
const transcriptTurns = ref<AiConversationTurn[]>([]);
const structuredJson = ref<Record<string, unknown>>({});
const summary = ref<Record<string, unknown>>({});
const soap = ref<Record<string, unknown>>({});

const appointmentOptions = computed((): AppointmentOption[] => {
  const opts = appStore.getData('hospital', 'AiConversationAppointmentOptions') as
    | { list?: AppointmentOption[] }
    | undefined;
  const start = (appStore.getData('hospital', 'AiConversationStart') ?? {}) as Record<string, unknown>;
  const fromStart = Array.isArray(start.appointments) ? (start.appointments as AppointmentOption[]) : [];
  return opts?.list?.length ? opts.list : fromStart;
});

const appointmentsLoading = computed(() => {
  const start = (appStore.getData('hospital', 'AiConversationStart') ?? {}) as Record<string, unknown>;
  return Boolean(start.loading);
});

const languageOptions = computed(() => [
  { value: 'mixed', label: t('aiConversation.languageOptions.mixed') },
  { value: 'en', label: t('aiConversation.languageOptions.en') },
  { value: 'hi', label: t('aiConversation.languageOptions.hi') },
  { value: 'kn', label: t('aiConversation.languageOptions.kn') }
]);

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
/** Local recorder slices (fallback full upload if no chunks reached the server). */
let chunks: BlobPart[] = [];
/** Slices not yet uploaded as a numbered server chunk. */
let pendingParts: BlobPart[] = [];
let nextChunkIndex = 0;
let serverChunkCount = 0;
let tickTimer: number | null = null;
let flushTimer: number | null = null;
let flushChain: Promise<void> = Promise.resolve();
let mimeType = 'audio/webm';
let pageHideBound = false;

const isDoctor = computed(() => {
  const auth = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  return String(auth.role ?? '').toUpperCase() === 'DOCTOR';
});

const timerLabel = computed(() => {
  const m = Math.floor(elapsedSec.value / 60);
  const s = elapsedSec.value % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const possibleDiagnosis = computed(() => {
  const list = summary.value.PossibleDiagnosis ?? summary.value.possibleDiagnosis;
  return Array.isArray(list) ? list.map((x) => String(x)) : [];
});

const soapSubjective = computed({
  get: () => String(soap.value.Subjective ?? soap.value.subjective ?? ''),
  set: (v: string) => {
    soap.value = { ...soap.value, Subjective: v };
  }
});
const soapObjective = computed({
  get: () => String(soap.value.Objective ?? soap.value.objective ?? ''),
  set: (v: string) => {
    soap.value = { ...soap.value, Objective: v };
  }
});
const soapAssessment = computed({
  get: () => String(soap.value.Assessment ?? soap.value.assessment ?? ''),
  set: (v: string) => {
    soap.value = { ...soap.value, Assessment: v };
  }
});
const soapPlan = computed({
  get: () => String(soap.value.Plan ?? soap.value.plan ?? ''),
  set: (v: string) => {
    soap.value = { ...soap.value, Plan: v };
  }
});

const patientSummary = computed({
  get: () => String(summary.value.PatientSummary ?? summary.value.patientSummary ?? ''),
  set: (v: string) => {
    summary.value = { ...summary.value, PatientSummary: v };
  }
});

function applySession(session: AiConversationSession) {
  sessionId.value = session.sessionId;
  appointmentId.value = session.appointmentId;
  if (typeof session.chunkCount === 'number' && Number.isFinite(session.chunkCount)) {
    serverChunkCount = Math.max(0, session.chunkCount);
    nextChunkIndex = Math.max(nextChunkIndex, serverChunkCount);
  }
  if (session.transcriptText) transcriptText.value = session.transcriptText;
  if (session.transcript?.length) transcriptTurns.value = session.transcript;
  if (Object.keys(session.structuredJson).length) structuredJson.value = session.structuredJson;
  if (Object.keys(session.summary).length) summary.value = session.summary;
  if (Object.keys(session.soap).length) soap.value = session.soap;
  if (session.message) statusLine.value = session.message;
}

function hydrateFromStore() {
  const start = (appStore.getData('hospital', 'AiConversationStart') ?? {}) as Record<string, unknown>;
  selectedAppointmentId.value = String(start.appointmentId ?? '').trim();
  languageHint.value = String(start.languageHint ?? 'mixed').trim() || 'mixed';
  consent.value = Boolean(start.consent);

  const s = (appStore.getData('hospital', 'AiConversationSession') ?? {}) as Record<string, unknown>;
  const sid = String(s.sessionId ?? '').trim();
  if (!sid) {
    phase.value = 'idle';
    return;
  }
  sessionId.value = sid;
  appointmentId.value = String(s.appointmentId ?? '').trim();
  swapSpeakers.value = Boolean(s.swapSpeakers);
  const p = String(s.phase ?? 'recording');
  if (p === 'recording' || p === 'paused' || p === 'review' || p === 'saved') {
    phase.value = p as Phase;
  } else {
    phase.value = 'recording';
  }
}

async function startRecordingSession() {
  error.value = '';
  if (!selectedAppointmentId.value.trim()) {
    error.value = t('aiConversation.errors.selectAppointment');
    return;
  }
  if (!consent.value) {
    error.value = t('aiConversation.errors.consentRequired');
    return;
  }
  starting.value = true;
  try {
    const session = await startAiConversation({
      appointmentId: selectedAppointmentId.value.trim(),
      languageHint: languageHint.value || 'mixed',
      consentAcknowledged: true
    });
    applySession(session);
    appStore.setData('hospital', 'AiConversationSession', {
      sessionId: session.sessionId,
      appointmentId: session.appointmentId,
      languageHint: session.languageHint || languageHint.value || 'mixed',
      phase: 'recording',
      swapSpeakers: false
    });
    appStore.setProperty('hospital', 'AiConversationStart', 'appointmentId', selectedAppointmentId.value);
    appStore.setProperty('hospital', 'AiConversationStart', 'languageHint', languageHint.value || 'mixed');
    appStore.setProperty('hospital', 'AiConversationStart', 'consent', true);
    await beginRecording();
  } catch (err: unknown) {
    const ax = err as { response?: { data?: Record<string, unknown> } };
    const msg = String(ax.response?.data?.Message ?? ax.response?.data?.message ?? '').trim();
    error.value = msg || t('aiConversation.errors.startFailed');
    phase.value = 'idle';
  } finally {
    starting.value = false;
  }
}

function clearTick() {
  if (tickTimer != null) {
    window.clearInterval(tickTimer);
    tickTimer = null;
  }
}

function clearFlushTimer() {
  if (flushTimer != null) {
    window.clearInterval(flushTimer);
    flushTimer = null;
  }
}

function chunkFilename(kind: 'chunk' | 'full' = 'chunk'): string {
  const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
  return kind === 'full' ? `consultation.${ext}` : `chunk.${ext}`;
}

function resetChunkState() {
  chunks = [];
  pendingParts = [];
  nextChunkIndex = 0;
  serverChunkCount = 0;
  flushChain = Promise.resolve();
  clearFlushTimer();
}

function requestRecorderData() {
  try {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.requestData();
    }
  } catch {
    /* ignore */
  }
}

async function flushPendingChunks(opts?: { keepalive?: boolean }): Promise<void> {
  if (!sessionId.value || pendingParts.length === 0) return;
  const parts = pendingParts;
  pendingParts = [];
  const blob = new Blob(parts, { type: mimeType || 'audio/webm' });
  if (!blob.size) return;

  const chunkIndex = nextChunkIndex;
  if (opts?.keepalive) {
    uploadAiConversationChunkKeepalive({
      sessionId: sessionId.value,
      durationSeconds: elapsedSec.value,
      chunkIndex,
      blob,
      filename: chunkFilename('chunk')
    });
    nextChunkIndex = chunkIndex + 1;
    serverChunkCount = Math.max(serverChunkCount, nextChunkIndex);
    return;
  }

  try {
    const uploaded = await uploadAiConversationAudio({
      sessionId: sessionId.value,
      durationSeconds: elapsedSec.value,
      blob,
      filename: chunkFilename('chunk'),
      chunkIndex
    });
    applySession(uploaded);
    nextChunkIndex = Math.max(nextChunkIndex, uploaded.chunkCount);
    serverChunkCount = Math.max(serverChunkCount, uploaded.chunkCount);
  } catch {
    pendingParts = [...parts, ...pendingParts];
    throw new Error('chunk_upload_failed');
  }
}

function enqueueFlush(opts?: { keepalive?: boolean }): Promise<void> {
  flushChain = flushChain
    .then(() => flushPendingChunks(opts))
    .catch(() => {
      /* keep queue; next flush retries */
    });
  return flushChain;
}

function startFlushTimer() {
  clearFlushTimer();
  flushTimer = window.setInterval(() => {
    requestRecorderData();
    void enqueueFlush();
  }, CHUNK_FLUSH_MS);
}

function onPageHideFlush() {
  if (phase.value !== 'recording' && phase.value !== 'paused') return;
  requestRecorderData();
  void enqueueFlush({ keepalive: true });
}

function onVisibilityFlush() {
  if (document.visibilityState !== 'hidden') return;
  if (phase.value !== 'recording' && phase.value !== 'paused') return;
  requestRecorderData();
  void enqueueFlush({ keepalive: true });
}

function bindUnloadFlush() {
  if (pageHideBound || typeof window === 'undefined') return;
  window.addEventListener('pagehide', onPageHideFlush);
  document.addEventListener('visibilitychange', onVisibilityFlush);
  pageHideBound = true;
}

function unbindUnloadFlush() {
  if (!pageHideBound || typeof window === 'undefined') return;
  window.removeEventListener('pagehide', onPageHideFlush);
  document.removeEventListener('visibilitychange', onVisibilityFlush);
  pageHideBound = false;
}

function stopTracks() {
  mediaRecorder = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((tr) => tr.stop());
    mediaStream = null;
  }
}

async function beginRecording() {
  error.value = '';
  if (!sessionId.value) {
    error.value = t('aiConversation.errors.noSession');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error.value = t('aiConversation.errors.unsupported');
    return;
  }
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1
      }
    });
    const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    mimeType = preferred.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    resetChunkState();
    mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType, audioBitsPerSecond: 128000 })
      : new MediaRecorder(mediaStream);
    mimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
        pendingParts.push(ev.data);
      }
    };
    mediaRecorder.start(1000);
    elapsedSec.value = 0;
    clearTick();
    tickTimer = window.setInterval(() => {
      elapsedSec.value += 1;
    }, 1000);
    startFlushTimer();
    bindUnloadFlush();
    phase.value = 'recording';
    appStore.setProperty('hospital', 'AiConversationSession', 'phase', 'recording');
  } catch {
    error.value = t('aiConversation.errors.micDenied');
    stopTracks();
  }
}

function pauseRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
  mediaRecorder.pause();
  clearTick();
  clearFlushTimer();
  requestRecorderData();
  void enqueueFlush();
  phase.value = 'paused';
}

function resumeRecording() {
  if (!mediaRecorder || mediaRecorder.state !== 'paused') return;
  mediaRecorder.resume();
  clearTick();
  tickTimer = window.setInterval(() => {
    elapsedSec.value += 1;
  }, 1000);
  startFlushTimer();
  phase.value = 'recording';
}

async function stopAndProcess() {
  error.value = '';
  if (!mediaRecorder) {
    error.value = t('aiConversation.errors.notRecording');
    return;
  }
  const recorder = mediaRecorder;
  phase.value = 'processing';
  statusLine.value = t('aiConversation.status.savingChunks');
  clearTick();
  clearFlushTimer();
  unbindUnloadFlush();

  const blob = await new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
    };
    recorder.onerror = () => reject(new Error('recorder_error'));
    try {
      requestRecorderData();
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
    } catch (e) {
      reject(e);
    }
  }).catch(() => new Blob(chunks, { type: mimeType || 'audio/webm' }));

  stopTracks();

  try {
    await enqueueFlush();
    if (pendingParts.length > 0) {
      await flushPendingChunks();
    }
  } catch {
    /* fall through — may still have local blob */
  }

  const hasServerChunks = serverChunkCount > 0;
  const leftoverPending = pendingParts.length > 0;
  chunks = [];
  pendingParts = [];

  if (!hasServerChunks && !blob.size) {
    phase.value = 'idle';
    error.value = t('aiConversation.errors.emptyAudio');
    return;
  }

  try {
    // Prefer assembled server chunks; fall back to one-shot upload if nothing landed or leftover failed.
    if (!hasServerChunks || leftoverPending) {
      if (!blob.size) {
        phase.value = 'idle';
        error.value = t('aiConversation.errors.emptyAudio');
        return;
      }
      statusLine.value = t('aiConversation.status.uploading');
      const uploaded = await uploadAiConversationAudio({
        sessionId: sessionId.value,
        durationSeconds: elapsedSec.value,
        blob,
        filename: chunkFilename('full')
      });
      applySession(uploaded);
    }
    statusLine.value = t('aiConversation.status.transcribing');
    const transcribed = await transcribeAiConversation(sessionId.value, swapSpeakers.value);
    applySession(transcribed);
    statusLine.value = t('aiConversation.status.analyzing');
    const analyzed = await analyzeAiConversation(sessionId.value);
    applySession(analyzed);
    statusLine.value = t('aiConversation.status.summarizing');
    const summarized = await generateAiConversationSummary(sessionId.value);
    applySession(summarized);
    phase.value = 'review';
    tab.value = 'transcript';
    appStore.setProperty('hospital', 'AiConversationSession', 'phase', 'review');
    statusLine.value = t('aiConversation.status.readyReview');
  } catch (err: unknown) {
    const ax = err as { response?: { data?: Record<string, unknown> } };
    const msg = String(ax.response?.data?.Message ?? ax.response?.data?.message ?? '').trim();
    error.value = msg || t('aiConversation.errors.pipelineFailed');
    phase.value = 'idle';
  }
}

async function swapAndRetranscribe() {
  if (!sessionId.value) return;
  swapSpeakers.value = !swapSpeakers.value;
  phase.value = 'processing';
  statusLine.value = t('aiConversation.status.transcribing');
  try {
    const transcribed = await transcribeAiConversation(sessionId.value, swapSpeakers.value);
    applySession(transcribed);
    const analyzed = await analyzeAiConversation(sessionId.value);
    applySession(analyzed);
    const summarized = await generateAiConversationSummary(sessionId.value);
    applySession(summarized);
    phase.value = 'review';
  } catch {
    error.value = t('aiConversation.errors.pipelineFailed');
    phase.value = 'review';
  }
}

function clearTranscript() {
  transcriptText.value = '';
  transcriptTurns.value = [];
}

async function copyActive() {
  let text = '';
  if (tab.value === 'transcript') text = transcriptText.value;
  else if (tab.value === 'summary') text = patientSummary.value;
  else if (tab.value === 'soap') {
    text = [
      `S: ${soapSubjective.value}`,
      `O: ${soapObjective.value}`,
      `A: ${soapAssessment.value}`,
      `P: ${soapPlan.value}`
    ].join('\n');
  } else text = possibleDiagnosis.value.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    statusLine.value = t('aiConversation.status.copied');
  } catch {
    error.value = t('aiConversation.errors.copyFailed');
  }
}

function downloadActive() {
  let text = '';
  let name = 'consultation.txt';
  if (tab.value === 'transcript') {
    text = transcriptText.value;
    name = 'transcript.txt';
  } else if (tab.value === 'summary') {
    text = JSON.stringify(summary.value, null, 2);
    name = 'summary.json';
  } else if (tab.value === 'soap') {
    text = JSON.stringify(soap.value, null, 2);
    name = 'soap.json';
  } else {
    text = possibleDiagnosis.value.join('\n');
    name = 'diagnosis.txt';
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function save() {
  error.value = '';
  try {
    const saved = await saveAiConversation({
      sessionId: sessionId.value,
      transcriptText: transcriptText.value,
      transcript: transcriptTurns.value,
      structuredJson: structuredJson.value,
      summary: { ...summary.value, Soap: soap.value },
      soap: soap.value
    });
    applySession(saved);
    phase.value = 'saved';
    appStore.setProperty('hospital', 'AiConversationSession', 'phase', 'saved');
    statusLine.value = saved.message || t('aiConversation.status.saved');
  } catch (err: unknown) {
    const ax = err as { response?: { data?: Record<string, unknown> } };
    const msg = String(ax.response?.data?.Message ?? ax.response?.data?.message ?? '').trim();
    error.value = msg || t('aiConversation.errors.saveFailed');
  }
}

onMounted(() => {
  hydrateFromStore();
  ensureDefaultAppointment();
  if (phase.value === 'recording' && sessionId.value) {
    void beginRecording();
  }
});

watch(
  () => appStore.getData('hospital', 'AiConversationSession'),
  () => {
    if (!sessionId.value) hydrateFromStore();
  }
);

function ensureDefaultAppointment() {
  if (selectedAppointmentId.value.trim()) return;
  const start = (appStore.getData('hospital', 'AiConversationStart') ?? {}) as Record<string, unknown>;
  const fromStart = String(start.appointmentId ?? '').trim();
  if (fromStart) {
    selectedAppointmentId.value = fromStart;
    return;
  }
  const first = appointmentOptions.value[0]?.value?.trim() ?? '';
  if (first) selectedAppointmentId.value = first;
}

watch(
  () => appStore.getData('hospital', 'AiConversationStart'),
  () => {
    if (phase.value === 'idle') {
      ensureDefaultAppointment();
      if (!languageHint.value) {
        languageHint.value = String(
          ((appStore.getData('hospital', 'AiConversationStart') ?? {}) as Record<string, unknown>)
            .languageHint ?? 'mixed'
        ).trim() || 'mixed';
      }
    }
  },
  { deep: true }
);

watch(appointmentOptions, () => {
  if (phase.value === 'idle') ensureDefaultAppointment();
});

onBeforeUnmount(() => {
  clearTick();
  clearFlushTimer();
  if (phase.value === 'recording' || phase.value === 'paused') {
    requestRecorderData();
    void enqueueFlush({ keepalive: true });
  }
  unbindUnloadFlush();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch {
      /* ignore */
    }
  }
  stopTracks();
});
</script>

<template>
  <section class="flex w-full min-w-0 flex-1 flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight text-[var(--brand-primary,#0f766e)]">
        {{ t('aiConversation.title') }}
      </h1>
      <p class="text-sm text-slate-600">{{ t('aiConversation.subtitle') }}</p>
      <p class="text-xs text-slate-500">{{ t('aiConversation.disclaimer') }}</p>
    </header>

    <p v-if="!isDoctor" class="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {{ t('aiConversation.doctorOnly') }}
    </p>

    <template v-else>
      <p v-if="error" class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</p>
      <p v-if="statusLine" class="text-sm text-slate-600">{{ statusLine }}</p>

      <div
        v-if="phase === 'idle'"
        class="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white/80 px-5 py-6"
      >
        <p class="text-sm text-slate-600">{{ t('aiConversation.languages') }}</p>
        <p class="text-sm text-slate-600">{{ t('aiConversation.notice') }}</p>

        <label class="flex flex-col gap-1 text-sm text-slate-700">
          <span class="font-medium">{{ t('aiConversation.languageHint') }}</span>
          <select
            v-model="languageHint"
            class="h-11 max-w-xl rounded-lg border border-slate-200 bg-white px-3"
            :disabled="starting"
          >
            <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label class="flex items-start gap-2 text-sm text-slate-700">
          <input v-model="consent" type="checkbox" class="mt-1 rounded" :disabled="starting" />
          <span>{{ t('aiConversation.consent') }}</span>
        </label>

        <div class="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            class="inline-flex min-w-40 h-12 items-center justify-center rounded-lg bg-[var(--brand-primary,#0f766e)] px-4 text-sm font-medium text-white disabled:opacity-60"
            :disabled="starting || appointmentsLoading"
            @click="startRecordingSession"
          >
            {{ starting ? t('aiConversation.starting') : t('aiConversation.startRecording') }}
          </button>
        </div>
      </div>

      <div
        v-else-if="phase === 'recording' || phase === 'paused'"
        class="flex flex-col items-center gap-4 rounded-xl border border-rose-200 bg-rose-50/60 px-5 py-8"
      >
        <p class="text-lg font-medium text-rose-700">
          <span v-if="phase === 'recording'">🔴 {{ t('aiConversation.recording') }}</span>
          <span v-else>⏸ {{ t('aiConversation.paused') }}</span>
        </p>
        <p class="font-mono text-3xl tabular-nums text-slate-800">{{ timerLabel }}</p>
        <p class="text-sm text-slate-600">{{ t('aiConversation.doctorConsultation') }}</p>
        <div class="flex flex-wrap justify-center gap-3">
          <button
            v-if="phase === 'recording'"
            type="button"
            class="inline-flex min-w-32 h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200"
            @click="pauseRecording"
          >
            {{ t('aiConversation.pause') }}
          </button>
          <button
            v-else
            type="button"
            class="inline-flex min-w-32 h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-200"
            @click="resumeRecording"
          >
            {{ t('aiConversation.resume') }}
          </button>
          <button
            type="button"
            class="inline-flex min-w-32 h-11 items-center justify-center rounded-lg bg-[var(--brand-primary,#0f766e)] px-4 text-sm font-medium text-white"
            @click="stopAndProcess"
          >
            {{ t('aiConversation.stop') }}
          </button>
        </div>
      </div>

      <div
        v-else-if="phase === 'processing'"
        class="rounded-xl border border-slate-200 bg-white/80 px-5 py-10 text-center"
      >
        <p class="text-base font-medium text-slate-800">{{ t('aiConversation.processing') }}</p>
        <p class="mt-2 text-sm text-slate-600">{{ statusLine }}</p>
      </div>

      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          <button
            v-for="id in (['transcript', 'summary', 'soap', 'diagnosis'] as TabId[])"
            :key="id"
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium"
            :class="tab === id ? 'bg-[var(--brand-primary,#0f766e)] text-white' : 'bg-slate-100 text-slate-700'"
            @click="tab = id"
          >
            {{ t(`aiConversation.tabs.${id}`) }}
          </button>
        </div>

        <div v-if="tab === 'transcript'" class="flex flex-col gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="swapSpeakers" type="checkbox" class="rounded" />
            {{ t('aiConversation.swapSpeakers') }}
          </label>
          <button
            type="button"
            class="self-start text-sm font-medium text-[var(--brand-primary,#0f766e)] underline"
            @click="swapAndRetranscribe"
          >
            {{ t('aiConversation.applySpeakerSwap') }}
          </button>
          <textarea
            v-model="transcriptText"
            rows="12"
            class="w-full rounded-lg border border-slate-200 bg-white p-3 font-noto text-sm leading-relaxed text-slate-800"
          />
        </div>

        <div v-else-if="tab === 'summary'" class="flex flex-col gap-2">
          <textarea
            v-model="patientSummary"
            rows="10"
            class="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800"
          />
        </div>

        <div v-else-if="tab === 'soap'" class="grid gap-3 sm:grid-cols-2">
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">S</span>
            <textarea v-model="soapSubjective" rows="4" class="rounded-lg border border-slate-200 p-2" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">O</span>
            <textarea v-model="soapObjective" rows="4" class="rounded-lg border border-slate-200 p-2" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">A</span>
            <textarea v-model="soapAssessment" rows="4" class="rounded-lg border border-slate-200 p-2" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">P</span>
            <textarea v-model="soapPlan" rows="4" class="rounded-lg border border-slate-200 p-2" />
          </label>
        </div>

        <ul v-else class="list-disc space-y-1 pl-5 text-sm text-slate-800">
          <li v-for="(dx, i) in possibleDiagnosis" :key="i">{{ dx }}</li>
          <li v-if="!possibleDiagnosis.length" class="list-none text-slate-500">
            {{ t('aiConversation.noDiagnosis') }}
          </li>
        </ul>

        <div class="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            class="inline-flex min-w-28 h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium ring-1 ring-slate-200"
            @click="copyActive"
          >
            {{ t('aiConversation.copy') }}
          </button>
          <button
            type="button"
            class="inline-flex min-w-28 h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium ring-1 ring-slate-200"
            @click="downloadActive"
          >
            {{ t('aiConversation.download') }}
          </button>
          <button
            v-if="tab === 'transcript'"
            type="button"
            class="inline-flex min-w-28 h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-red-700 ring-1 ring-red-200"
            @click="clearTranscript"
          >
            {{ t('aiConversation.deleteTranscript') }}
          </button>
          <button
            v-if="phase !== 'saved'"
            type="button"
            class="inline-flex min-w-28 h-11 items-center justify-center rounded-lg bg-[var(--brand-primary,#0f766e)] px-4 text-sm font-medium text-white"
            @click="save"
          >
            {{ t('aiConversation.save') }}
          </button>
          <p v-else class="self-center text-sm font-medium text-emerald-700">✔ {{ t('aiConversation.saved') }}</p>
        </div>
      </div>
    </template>
  </section>
</template>
