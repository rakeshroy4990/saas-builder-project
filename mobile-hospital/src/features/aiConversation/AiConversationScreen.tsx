import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState
} from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';

import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import {
  analyzeAiConversation,
  apiErrorMessage,
  applyAiConversationToEprescription,
  emptyAiConversationPrescription,
  formatAiConversationPrescription,
  generateAiConversationPrescription,
  generateAiConversationSummary,
  loadDoctorAppointmentsForAiConversation,
  saveAiConversation,
  startAiConversation,
  transcribeAiConversation,
  uploadAiConversationAudio,
  type AiConversationMedicine,
  type AiConversationPrescription,
  type AiConversationSession,
  type AppointmentOption
} from '@/features/aiConversation/aiConversationApi';
import { colors } from '@/theme/colors';
import { TAB_SCROLL_BOTTOM_PADDING } from '@/theme/layout';
import { sharedStyles } from '@/theme/styles';

type Phase = 'idle' | 'recording' | 'paused' | 'processing' | 'review' | 'saved';
type TabId = 'transcript' | 'summary' | 'soap' | 'diagnosis' | 'prescription';

const LANGUAGE_OPTIONS = [
  { value: 'mixed', labelKey: 'aiConversation.languageOptions.mixed' },
  { value: 'en', labelKey: 'aiConversation.languageOptions.en' },
  { value: 'hi', labelKey: 'aiConversation.languageOptions.hi' },
  { value: 'kn', labelKey: 'aiConversation.languageOptions.kn' }
] as const;

function emptyMedicine(): AiConversationMedicine {
  return {
    Name: '',
    Strength: '',
    Dose: '',
    Frequency: '',
    Route: '',
    DurationDays: '',
    Instructions: '',
    ScheduleCategory: ''
  };
}

function timerLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function AiConversationScreen() {
  const { t } = useTranslation();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document'
  });
  const recorderState = useAudioRecorderState(recorder);

  const [phase, setPhase] = useState<Phase>('idle');
  const [tab, setTab] = useState<TabId>('prescription');
  const [error, setError] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const [starting, setStarting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [languageHint, setLanguageHint] = useState('mixed');
  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [swapSpeakers, setSwapSpeakers] = useState(false);
  const [applyingEprescription, setApplyingEprescription] = useState(false);

  const [sessionId, setSessionId] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptTurns, setTranscriptTurns] = useState<AiConversationSession['transcript']>([]);
  const [structuredJson, setStructuredJson] = useState<Record<string, unknown>>({});
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [soap, setSoap] = useState<Record<string, unknown>>({});
  const [prescription, setPrescription] = useState<AiConversationPrescription>(
    emptyAiConversationPrescription()
  );

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const possibleDiagnosis = useMemo(() => {
    const list = summary.PossibleDiagnosis ?? summary.possibleDiagnosis;
    return Array.isArray(list) ? list.map((x) => String(x)) : [];
  }, [summary]);

  const patientSummary = String(summary.PatientSummary ?? summary.patientSummary ?? '');
  const soapSubjective = String(soap.Subjective ?? soap.subjective ?? '');
  const soapObjective = String(soap.Objective ?? soap.objective ?? '');
  const soapAssessment = String(soap.Assessment ?? soap.assessment ?? '');
  const soapPlan = String(soap.Plan ?? soap.plan ?? '');

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const applySession = useCallback((session: AiConversationSession) => {
    if (session.sessionId) setSessionId(session.sessionId);
    if (session.transcriptText) setTranscriptText(session.transcriptText);
    if (session.transcript?.length) setTranscriptTurns(session.transcript);
    if (Object.keys(session.structuredJson).length) setStructuredJson(session.structuredJson);
    if (Object.keys(session.summary).length) setSummary(session.summary);
    if (Object.keys(session.soap).length) setSoap(session.soap);
    if (session.prescription) setPrescription(session.prescription);
    if (session.message) setStatusLine(session.message);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAppointmentsLoading(true);
      try {
        const rows = await loadDoctorAppointmentsForAiConversation();
        if (cancelled) return;
        setAppointments(rows);
        if (rows[0]?.value) setSelectedAppointmentId(rows[0].value);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, t('aiConversation.errors.startFailed')));
      } finally {
        if (!cancelled) setAppointmentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    return () => {
      clearTick();
      try {
        if (recorder.isRecording) {
          void recorder.stop();
        }
      } catch {
        /* ignore */
      }
    };
  }, [clearTick, recorder]);

  async function ensureMicPermission(): Promise<boolean> {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    return Boolean(status.granted);
  }

  async function beginRecording() {
    setError('');
    const granted = await ensureMicPermission();
    if (!granted) {
      setError(t('aiConversation.errors.micDenied'));
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      elapsedRef.current = 0;
      setElapsedSec(0);
      clearTick();
      tickRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSec(elapsedRef.current);
      }, 1000);
      setPhase('recording');
    } catch {
      setError(t('aiConversation.errors.micDenied'));
    }
  }

  async function startRecordingSession() {
    setError('');
    if (!selectedAppointmentId.trim()) {
      setError(t('aiConversation.errors.selectAppointment'));
      return;
    }
    if (!consent) {
      setError(t('aiConversation.errors.consentRequired'));
      return;
    }
    setStarting(true);
    try {
      const session = await startAiConversation({
        appointmentId: selectedAppointmentId.trim(),
        languageHint: languageHint || 'mixed',
        consentAcknowledged: true
      });
      applySession(session);
      await beginRecording();
    } catch (err) {
      setError(apiErrorMessage(err, t('aiConversation.errors.startFailed')));
      setPhase('idle');
    } finally {
      setStarting(false);
    }
  }

  function pauseRecording() {
    if (!recorder.isRecording) return;
    recorder.pause();
    clearTick();
    setPhase('paused');
  }

  function resumeRecording() {
    if (phase !== 'paused') return;
    recorder.record();
    clearTick();
    tickRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSec(elapsedRef.current);
    }, 1000);
    setPhase('recording');
  }

  async function runPipeline() {
    if (!sessionId) {
      setError(t('aiConversation.errors.noSession'));
      return;
    }
    setPhase('processing');
    try {
      setStatusLine(t('aiConversation.status.transcribing'));
      applySession(await transcribeAiConversation(sessionId, swapSpeakers));
      setStatusLine(t('aiConversation.status.analyzing'));
      applySession(await analyzeAiConversation(sessionId));
      setStatusLine(t('aiConversation.status.summarizing'));
      applySession(await generateAiConversationSummary(sessionId));
      setStatusLine(t('aiConversation.status.prescribing'));
      applySession(await generateAiConversationPrescription(sessionId));
      setPhase('review');
      setTab('prescription');
      setStatusLine(t('aiConversation.status.readyReview'));
    } catch (err) {
      setError(apiErrorMessage(err, t('aiConversation.errors.pipelineFailed')));
      setPhase('idle');
    }
  }

  async function stopAndProcess() {
    setError('');
    if (!sessionId) {
      setError(t('aiConversation.errors.notRecording'));
      return;
    }
    setPhase('processing');
    setStatusLine(t('aiConversation.status.uploading'));
    clearTick();
    try {
      if (recorder.isRecording || recorderState.isRecording) {
        await recorder.stop();
      }
      const uri = recorder.uri;
      if (!uri) {
        setError(t('aiConversation.errors.emptyAudio'));
        setPhase('idle');
        return;
      }
      const uploaded = await uploadAiConversationAudio({
        sessionId,
        durationSeconds: elapsedRef.current,
        fileUri: uri,
        filename: 'consultation.m4a',
        mimeType: 'audio/mp4'
      });
      applySession(uploaded);
      await runPipeline();
    } catch (err) {
      setError(apiErrorMessage(err, t('aiConversation.errors.pipelineFailed')));
      setPhase('idle');
    }
  }

  async function regeneratePrescription() {
    if (!sessionId) return;
    setError('');
    setPhase('processing');
    setStatusLine(t('aiConversation.status.prescribing'));
    try {
      applySession(await generateAiConversationPrescription(sessionId));
      setPhase('review');
      setTab('prescription');
      setStatusLine(t('aiConversation.status.prescriptionReady'));
    } catch (err) {
      setError(apiErrorMessage(err, t('aiConversation.errors.prescriptionFailed')));
      setPhase('review');
    }
  }

  async function applyToEprescription() {
    if (!sessionId) return;
    setError('');
    setApplyingEprescription(true);
    try {
      const res = await applyAiConversationToEprescription({ sessionId, prescription });
      applySession(res);
      setStatusLine(res.message || t('aiConversation.status.eprescriptionApplied'));
    } catch (err) {
      setError(apiErrorMessage(err, t('aiConversation.errors.eprescriptionFailed')));
    } finally {
      setApplyingEprescription(false);
    }
  }

  async function onSave() {
    if (!sessionId) return;
    setError('');
    try {
      const saved = await saveAiConversation({
        sessionId,
        transcriptText,
        transcript: transcriptTurns,
        structuredJson,
        summary: { ...summary, Soap: soap },
        soap,
        prescription
      });
      applySession(saved);
      setPhase('saved');
      setStatusLine(saved.message || t('aiConversation.status.saved'));
    } catch (err) {
      setError(apiErrorMessage(err, t('aiConversation.errors.saveFailed')));
    }
  }

  async function copyActive() {
    let text = '';
    if (tab === 'transcript') text = transcriptText;
    else if (tab === 'summary') text = patientSummary;
    else if (tab === 'soap') {
      text = [`S: ${soapSubjective}`, `O: ${soapObjective}`, `A: ${soapAssessment}`, `P: ${soapPlan}`].join(
        '\n'
      );
    } else if (tab === 'prescription') text = formatAiConversationPrescription(prescription);
    else text = possibleDiagnosis.join('\n');
    try {
      await Clipboard.setStringAsync(text);
      setStatusLine(t('aiConversation.status.copied'));
    } catch {
      setError(t('aiConversation.errors.copyFailed'));
    }
  }

  async function shareActive() {
    const text =
      tab === 'prescription'
        ? formatAiConversationPrescription(prescription)
        : tab === 'transcript'
          ? transcriptText
          : patientSummary;
    try {
      if (!cacheDirectory) {
        await Clipboard.setStringAsync(text);
        setStatusLine(t('aiConversation.status.copied'));
        return;
      }
      const path = `${cacheDirectory}ai-conversation-share.txt`;
      await writeAsStringAsync(path, text, { encoding: EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: t('aiConversation.title') });
      } else {
        await Clipboard.setStringAsync(text);
        setStatusLine(t('aiConversation.status.copied'));
      }
    } catch {
      Alert.alert(t('aiConversation.title'), t('aiConversation.errors.copyFailed'));
    }
  }

  function updateMedicine(index: number, field: keyof AiConversationMedicine, value: string) {
    setPrescription((prev) => ({
      ...prev,
      Medicines: prev.Medicines.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    }));
  }

  const tabs: TabId[] = ['transcript', 'summary', 'soap', 'diagnosis', 'prescription'];

  return (
    <KeyboardSafeView>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={sharedStyles.title}>{t('aiConversation.title')}</Text>
        <Text style={[sharedStyles.subtitle, styles.gap]}>{t('aiConversation.subtitle')}</Text>
        <Text style={styles.disclaimer}>{t('aiConversation.disclaimer')}</Text>

        {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}
        {statusLine ? <Text style={styles.status}>{statusLine}</Text> : null}

        {phase === 'idle' ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t('aiConversation.languages')}</Text>
            <Text style={[styles.body, styles.gap]}>{t('aiConversation.notice')}</Text>

            <Text style={sharedStyles.label}>{t('aiConversation.appointment')}</Text>
            {appointmentsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : appointments.length ? (
              <View style={styles.chipRow}>
                {appointments.slice(0, 8).map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.chip, selectedAppointmentId === opt.value && styles.chipActive]}
                    onPress={() => setSelectedAppointmentId(opt.value)}
                  >
                    <Text
                      style={[styles.chipText, selectedAppointmentId === opt.value && styles.chipTextActive]}
                      numberOfLines={2}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>{t('aiConversation.errors.selectAppointment')}</Text>
            )}

            <Text style={[sharedStyles.label, styles.gapTop]}>{t('aiConversation.languageHint')}</Text>
            <View style={styles.chipRow}>
              {LANGUAGE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.chip, languageHint === opt.value && styles.chipActive]}
                  onPress={() => setLanguageHint(opt.value)}
                >
                  <Text style={[styles.chipText, languageHint === opt.value && styles.chipTextActive]}>
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.consentRow} onPress={() => setConsent((c) => !c)}>
              <View style={[styles.checkbox, consent && styles.checkboxOn]} />
              <Text style={styles.consentText}>{t('aiConversation.consent')}</Text>
            </Pressable>

            <Pressable
              style={[sharedStyles.button, (starting || appointmentsLoading) && styles.disabled]}
              disabled={starting || appointmentsLoading}
              onPress={() => void startRecordingSession()}
            >
              <Text style={sharedStyles.buttonText}>
                {starting ? t('aiConversation.starting') : t('aiConversation.startRecording')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'recording' || phase === 'paused' ? (
          <View style={[styles.card, styles.recordingCard]}>
            <Text style={styles.recordingTitle}>
              {phase === 'recording' ? `🔴 ${t('aiConversation.recording')}` : `⏸ ${t('aiConversation.paused')}`}
            </Text>
            <Text style={styles.timer}>{timerLabel(elapsedSec)}</Text>
            <Text style={styles.muted}>{t('aiConversation.doctorConsultation')}</Text>
            <View style={styles.row}>
              {phase === 'recording' ? (
                <Pressable style={styles.secondaryBtn} onPress={pauseRecording}>
                  <Text style={styles.secondaryBtnText}>{t('aiConversation.pause')}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.secondaryBtn} onPress={resumeRecording}>
                  <Text style={styles.secondaryBtnText}>{t('aiConversation.resume')}</Text>
                </Pressable>
              )}
              <Pressable style={sharedStyles.button} onPress={() => void stopAndProcess()}>
                <Text style={sharedStyles.buttonText}>{t('aiConversation.stop')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'processing' ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.body, styles.gapTop]}>{t('aiConversation.processing')}</Text>
            <Text style={styles.muted}>{statusLine}</Text>
          </View>
        ) : null}

        {phase === 'review' || phase === 'saved' ? (
          <View style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
              {tabs.map((id) => (
                <Pressable
                  key={id}
                  style={[styles.tab, tab === id && styles.tabActive]}
                  onPress={() => setTab(id)}
                >
                  <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
                    {t(`aiConversation.tabs.${id}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {tab === 'transcript' ? (
              <>
                <Pressable style={styles.consentRow} onPress={() => setSwapSpeakers((v) => !v)}>
                  <View style={[styles.checkbox, swapSpeakers && styles.checkboxOn]} />
                  <Text style={styles.consentText}>{t('aiConversation.swapSpeakers')}</Text>
                </Pressable>
                <TextInput
                  style={[sharedStyles.input, styles.textarea]}
                  multiline
                  value={transcriptText}
                  onChangeText={setTranscriptText}
                />
              </>
            ) : null}

            {tab === 'summary' ? (
              <TextInput
                style={[sharedStyles.input, styles.textarea]}
                multiline
                value={patientSummary}
                onChangeText={(v) => setSummary((s) => ({ ...s, PatientSummary: v }))}
              />
            ) : null}

            {tab === 'soap' ? (
              <View style={styles.soapGrid}>
                {(
                  [
                    ['S', soapSubjective, 'Subjective'],
                    ['O', soapObjective, 'Objective'],
                    ['A', soapAssessment, 'Assessment'],
                    ['P', soapPlan, 'Plan']
                  ] as const
                ).map(([label, value, key]) => (
                  <View key={key} style={styles.soapCell}>
                    <Text style={sharedStyles.label}>{label}</Text>
                    <TextInput
                      style={[sharedStyles.input, styles.soapInput]}
                      multiline
                      value={value}
                      onChangeText={(v) => setSoap((s) => ({ ...s, [key]: v }))}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            {tab === 'diagnosis' ? (
              possibleDiagnosis.length ? (
                possibleDiagnosis.map((dx, i) => (
                  <Text key={`${dx}-${i}`} style={styles.body}>
                    • {dx}
                  </Text>
                ))
              ) : (
                <Text style={styles.muted}>{t('aiConversation.noDiagnosis')}</Text>
              )
            ) : null}

            {tab === 'prescription' ? (
              <View style={styles.rxBlock}>
                <Text style={styles.muted}>{t('aiConversation.prescription.hint')}</Text>
                {(
                  [
                    ['complaint', 'Complaint'],
                    ['history', 'History'],
                    ['allergies', 'Allergies'],
                    ['diagnosis', 'Diagnosis'],
                    ['advice', 'Advice'],
                    ['followUp', 'FollowUpAdvice'],
                    ['clinicalNotes', 'ClinicalNotes']
                  ] as const
                ).map(([labelKey, field]) => (
                  <View key={field} style={styles.gapTop}>
                    <Text style={sharedStyles.label}>{t(`aiConversation.prescription.${labelKey}`)}</Text>
                    <TextInput
                      style={[
                        sharedStyles.input,
                        field === 'Allergies' ? null : styles.rxField
                      ]}
                      multiline={field !== 'Allergies'}
                      value={String(prescription[field] ?? '')}
                      onChangeText={(v) => setPrescription((p) => ({ ...p, [field]: v }))}
                    />
                  </View>
                ))}

                <View style={[styles.row, styles.gapTop]}>
                  <Text style={[sharedStyles.label, { flex: 1 }]}>
                    {t('aiConversation.prescription.medicines')}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setPrescription((p) => ({ ...p, Medicines: [...p.Medicines, emptyMedicine()] }))
                    }
                  >
                    <Text style={styles.link}>{t('aiConversation.prescription.addMedicine')}</Text>
                  </Pressable>
                </View>
                {!prescription.Medicines.length ? (
                  <Text style={styles.muted}>{t('aiConversation.prescription.noMedicines')}</Text>
                ) : null}
                {prescription.Medicines.map((med, idx) => (
                  <View key={`med-${idx}`} style={styles.medCard}>
                    {(
                      [
                        ['medName', 'Name'],
                        ['strength', 'Strength'],
                        ['dose', 'Dose'],
                        ['frequency', 'Frequency'],
                        ['route', 'Route'],
                        ['durationDays', 'DurationDays'],
                        ['instructions', 'Instructions']
                      ] as const
                    ).map(([labelKey, field]) => (
                      <View key={field} style={styles.gapTop}>
                        <Text style={styles.smallLabel}>{t(`aiConversation.prescription.${labelKey}`)}</Text>
                        <TextInput
                          style={sharedStyles.input}
                          value={med[field]}
                          onChangeText={(v) => updateMedicine(idx, field, v)}
                        />
                      </View>
                    ))}
                    <Pressable
                      onPress={() =>
                        setPrescription((p) => ({
                          ...p,
                          Medicines: p.Medicines.filter((_, i) => i !== idx)
                        }))
                      }
                    >
                      <Text style={styles.dangerLink}>{t('aiConversation.prescription.removeMedicine')}</Text>
                    </Pressable>
                  </View>
                ))}

                <Text style={[sharedStyles.label, styles.gapTop]}>
                  {t('aiConversation.prescription.investigations')}
                </Text>
                <TextInput
                  style={[sharedStyles.input, styles.rxField]}
                  multiline
                  placeholder={t('aiConversation.prescription.investigationsHint')}
                  value={prescription.Investigations.join('\n')}
                  onChangeText={(v) =>
                    setPrescription((p) => ({
                      ...p,
                      Investigations: v
                        .split(/\r?\n/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                    }))
                  }
                />

                <View style={[styles.row, styles.gapTop]}>
                  <Pressable style={styles.secondaryBtn} onPress={() => void regeneratePrescription()}>
                    <Text style={styles.secondaryBtnText}>{t('aiConversation.prescription.regenerate')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryBtn, applyingEprescription && styles.disabled]}
                    disabled={applyingEprescription}
                    onPress={() => void applyToEprescription()}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {applyingEprescription
                        ? t('aiConversation.prescription.applying')
                        : t('aiConversation.prescription.applyToEprescription')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={[styles.row, styles.gapTop]}>
              <Pressable style={styles.secondaryBtn} onPress={() => void copyActive()}>
                <Text style={styles.secondaryBtnText}>{t('aiConversation.copy')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => void shareActive()}>
                <Text style={styles.secondaryBtnText}>{t('aiConversation.download')}</Text>
              </Pressable>
              {phase !== 'saved' ? (
                <Pressable style={sharedStyles.button} onPress={() => void onSave()}>
                  <Text style={sharedStyles.buttonText}>{t('aiConversation.save')}</Text>
                </Pressable>
              ) : (
                <Text style={styles.saved}>✔ {t('aiConversation.saved')}</Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: TAB_SCROLL_BOTTOM_PADDING,
    gap: 8
  },
  gap: { marginTop: 4 },
  gapTop: { marginTop: 12 },
  disclaimer: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  status: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    marginTop: 8
  },
  recordingCard: { backgroundColor: '#fff1f2', borderColor: '#fecdd3', alignItems: 'center' },
  recordingTitle: { fontSize: 17, fontWeight: '700', color: '#be123c' },
  timer: { fontSize: 36, fontWeight: '700', fontVariant: ['tabular-nums'], marginVertical: 8 },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '100%',
    backgroundColor: '#f8fafc'
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.text, maxWidth: 220 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginVertical: 14 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: 2
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  secondaryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff'
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.text },
  disabled: { opacity: 0.55 },
  tabScroll: { marginBottom: 10 },
  tab: {
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.text },
  tabTextActive: { color: '#fff' },
  textarea: { minHeight: 160, textAlignVertical: 'top', marginTop: 8 },
  soapGrid: { gap: 10 },
  soapCell: { gap: 4 },
  soapInput: { minHeight: 72, textAlignVertical: 'top' },
  rxBlock: { gap: 4 },
  rxField: { minHeight: 72, textAlignVertical: 'top' },
  medCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: '#f8fafc'
  },
  smallLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  dangerLink: { color: '#b91c1c', fontWeight: '600', fontSize: 12, marginTop: 8 },
  saved: { color: '#047857', fontWeight: '700', fontSize: 14 }
});
