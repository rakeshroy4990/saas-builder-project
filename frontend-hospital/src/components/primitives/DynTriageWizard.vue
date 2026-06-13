<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '../../store/useAppStore';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import { useActionEngine } from '../../composables/useActionEngine';
import { hospitalTriagePage } from '../../configs/hospital/triagePage';
import { TRIAGE_FREQUENCY_VALUES, type TriageFrequency } from '../../services/domain/hospital/triage/triageServices';
import { resolveStyle } from '../../core/engine/StyleResolver';
import DynButton from './DynButton.vue';

const appStore = useAppStore(pinia);
const toastStore = useToastStore(pinia);
const engine = useActionEngine(hospitalTriagePage);
const { t } = useI18n();

const frequencyOptions = TRIAGE_FREQUENCY_VALUES.map((value) => ({
  value,
  labelKey: `triage.frequency.${value}`
}));

const formFieldClass = resolveStyle({ styleTemplate: 'form.label.stack' });
const fieldLabelClass = 'text-sm font-medium text-slate-800';
const inputClass = resolveStyle({ styleTemplate: 'hosp.form.input' });
const textareaClass = resolveStyle({ styleTemplate: 'hosp.form.textarea' });
const formActionsClass = 'flex flex-wrap items-center justify-end gap-3 pt-2';
const resultActionsClass = 'flex flex-wrap items-center justify-center gap-3';

const primaryButtonStyles = { styleTemplate: 'hosp.popup.button.primary' };
const secondaryButtonStyles = { styleTemplate: 'hosp.popup.button.secondary' };

const session = computed(() => {
  void appStore.dataRevision;
  const raw = (appStore.getData('hospital', 'TriageSession') ?? {}) as Record<string, unknown>;
  const legacySymptoms = Array.isArray(raw.reportedSymptoms) ? (raw.reportedSymptoms as string[]).join(', ') : '';
  return {
    step: String(raw.step ?? 'form'),
    childAgeMonths: raw.childAgeMonths == null ? '' : String(raw.childAgeMonths),
    symptomText: String(raw.symptomText ?? legacySymptoms),
    symptomFrequency: String(raw.symptomFrequency ?? ''),
    symptomBrief: String(raw.symptomBrief ?? ''),
    urgencyLevel: String(raw.urgencyLevel ?? ''),
    urgencyReasoning: String(raw.urgencyReasoning ?? ''),
    redFlags: Array.isArray(raw.redFlags) ? (raw.redFlags as string[]) : [],
    streamPhase: String(raw.streamPhase ?? ''),
    streamPreview: String(raw.streamPreview ?? '')
  };
});

const analyzeButtonConfig = computed(() => ({
  text: t('triage.analyze'),
  styles: primaryButtonStyles
}));

const bookButtonConfig = computed(() => ({
  text: t('triage.bookAppointment'),
  styles: primaryButtonStyles,
  click: { actionId: 'triage-book-appointment' }
}));

const symptomCheckerButtonConfig = computed(() => ({
  text: t('triage.symptomChecker'),
  styles: secondaryButtonStyles,
  click: { actionId: 'triage-restart-checker' }
}));

const streamStatusText = computed(() => {
  void appStore.dataRevision;
  const phase = session.value.streamPhase.trim();
  if (!phase || phase === 'processing') return t('triage.analyzing');
  const key = `triage.streamPhase.${phase}`;
  const translated = t(key);
  return translated !== key ? translated : t('triage.analyzing');
});

function extractTriagePreviewText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const marker = '"UrgencyReasoning"';
  const markerIdx = trimmed.indexOf(marker);
  if (markerIdx >= 0) {
    const after = trimmed.slice(markerIdx + marker.length);
    const match = after.match(/^\s*:\s*"/);
    if (!match) return '';
    let out = '';
    let i = match[0].length;
    while (i < after.length) {
      const ch = after[i];
      if (ch === '"') break;
      if (ch === '\\' && i + 1 < after.length) {
        const next = after[i + 1];
        if (next === 'n') out += '\n';
        else if (next === 't') out += '\t';
        else if (next === 'r') out += '\r';
        else if (next === '"') out += '"';
        else if (next === '\\') out += '\\';
        else out += next;
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
    }
    const visible = out.trim();
    return visible.length > 400 ? visible.slice(-400) : visible;
  }

  if (trimmed.startsWith('{')) return '';
  return trimmed.length > 400 ? trimmed.slice(-400) : trimmed;
}

const streamPreviewText = computed(() => {
  void appStore.dataRevision;
  return extractTriagePreviewText(session.value.streamPreview);
});

const showStreamWaitingHint = computed(() => {
  void appStore.dataRevision;
  return !streamPreviewText.value && !session.value.streamPhase.trim();
});

const urgencyClass = computed(() => {
  const level = session.value.urgencyLevel.toUpperCase();
  if (level === 'EMERGENCY') return 'bg-red-100 text-red-800 border-red-300';
  if (level === 'CLINIC_VISIT') return 'bg-amber-100 text-amber-900 border-amber-300';
  return 'bg-emerald-100 text-emerald-900 border-emerald-300';
});

function patch(data: Record<string, unknown>) {
  const prev = (appStore.getData('hospital', 'TriageSession') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'TriageSession', { ...prev, ...data });
}

function parseSymptomInput(text: string): string[] {
  return text
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function submitAnalyze() {
  const age = Number(session.value.childAgeMonths);
  if (!Number.isFinite(age) || age < 0) {
    toastStore.show(t('triage.errors.ageRequired'), 'error');
    return;
  }

  const reportedSymptoms = parseSymptomInput(session.value.symptomText);
  if (!reportedSymptoms.length) {
    toastStore.show(t('triage.errors.symptomRequired'), 'error');
    return;
  }

  const frequency = session.value.symptomFrequency.trim();
  if (!(TRIAGE_FREQUENCY_VALUES as readonly string[]).includes(frequency)) {
    toastStore.show(t('triage.errors.frequencyRequired'), 'error');
    return;
  }

  patch({
    childAgeMonths: age,
    symptomText: session.value.symptomText,
    reportedSymptoms,
    symptomFrequency: frequency as TriageFrequency,
    symptomBrief: session.value.symptomBrief
  });
  await engine.execute({ actionId: 'triage-submit-analyze' });
}

async function runEngineAction(event: { action?: { actionId?: string } }) {
  const actionId = String(event.action?.actionId ?? '').trim();
  if (!actionId) return;
  await engine.execute({ actionId });
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-if="session.step === 'form' || session.step === 'profile' || session.step === 'symptoms'">
      <div :class="formFieldClass">
        <label :class="fieldLabelClass" for="triage-age-months">{{ t('triage.ageMonths') }}</label>
        <input
          id="triage-age-months"
          type="number"
          min="0"
          :class="inputClass"
          :value="session.childAgeMonths"
          @input="patch({ childAgeMonths: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div :class="formFieldClass">
        <label :class="fieldLabelClass" for="triage-symptoms">{{ t('triage.symptomsLabel') }}</label>
        <input
          id="triage-symptoms"
          :class="inputClass"
          :placeholder="t('triage.symptomPlaceholder')"
          :value="session.symptomText"
          @input="patch({ symptomText: ($event.target as HTMLInputElement).value })"
        />
      </div>
      <div :class="formFieldClass">
        <label :class="fieldLabelClass" for="triage-frequency">{{ t('triage.frequency.label') }}</label>
        <select
          id="triage-frequency"
          :class="inputClass"
          :value="session.symptomFrequency"
          @change="patch({ symptomFrequency: ($event.target as HTMLSelectElement).value })"
        >
          <option disabled value="">{{ t('triage.frequency.placeholder') }}</option>
          <option v-for="option in frequencyOptions" :key="option.value" :value="option.value">
            {{ t(option.labelKey) }}
          </option>
        </select>
      </div>
      <div :class="formFieldClass">
        <label :class="fieldLabelClass" for="triage-symptom-brief">
          {{ t('triage.symptomBrief.label') }}
          <span class="font-normal text-slate-500">{{ t('triage.symptomBrief.optional') }}</span>
        </label>
        <textarea
          id="triage-symptom-brief"
          rows="3"
          :class="textareaClass"
          :placeholder="t('triage.symptomBrief.placeholder')"
          :value="session.symptomBrief"
          @input="patch({ symptomBrief: ($event.target as HTMLTextAreaElement).value })"
        />
      </div>
      <div :class="formActionsClass">
        <DynButton :config="analyzeButtonConfig" @action="submitAnalyze" />
      </div>
    </template>

    <template v-else-if="session.step === 'loading'">
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
        <div class="flex items-center gap-3">
          <div
            class="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-teal-200 border-t-teal-700"
            aria-hidden="true"
          />
          <p class="text-sm font-medium text-slate-800">{{ streamStatusText }}</p>
        </div>
        <div class="mt-3 min-h-24 text-left text-sm leading-relaxed text-slate-700">
          <p v-if="streamPreviewText" class="whitespace-pre-wrap">
            {{ streamPreviewText }}<span class="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-teal-600 align-middle" />
          </p>
          <p v-else-if="showStreamWaitingHint" class="text-slate-500">{{ t('triage.streamWaiting') }}</p>
        </div>
      </div>
    </template>

    <template v-else-if="session.step === 'result'">
      <div :class="['rounded border px-4 py-3', urgencyClass]">
        <p class="text-sm font-semibold uppercase tracking-wide">{{ session.urgencyLevel.replace('_', ' ') }}</p>
        <p class="mt-2 text-sm">{{ session.urgencyReasoning }}</p>
      </div>
      <div v-if="session.redFlags.length" class="flex flex-wrap gap-2">
        <span
          v-for="flag in session.redFlags"
          :key="flag"
          class="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
        >
          {{ flag }}
        </span>
      </div>
      <p class="text-xs text-gray-500">{{ t('triage.resultDisclaimer') }}</p>
      <div :class="resultActionsClass">
        <DynButton :config="bookButtonConfig" @action="runEngineAction" />
        <DynButton :config="symptomCheckerButtonConfig" @action="runEngineAction" />
      </div>
    </template>
  </div>
</template>
