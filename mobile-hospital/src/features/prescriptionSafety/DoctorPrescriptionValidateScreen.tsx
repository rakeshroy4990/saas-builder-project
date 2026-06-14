import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { toUserFacingApiError } from '@/api/apiErrors';
import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import {
  postDoctorPrescriptionTranscribeUploadStream,
  riskBadgeStyle,
  validateDoctorPrescriptionFromSummary,
  type DoctorPrescriptionTranscribeResult,
  type PrescriptionValidationResult
} from '@/features/prescriptionSafety/doctorPrescriptionSafetyApi';
import {
  capturePrescriptionPhoto,
  pickPrescriptionImagesFromLibrary,
  type PickedPrescriptionFile
} from '@/features/prescriptions/pickPrescriptionImages';
import { colors } from '@/theme/colors';
import { TAB_SCROLL_BOTTOM_PADDING } from '@/theme/layout';
import { sharedStyles } from '@/theme/styles';

function extractedMedicines(
  validation: PrescriptionValidationResult | null,
  transcribe: DoctorPrescriptionTranscribeResult | null
): string[] {
  const fromValidation = (validation?.dosageFindings ?? [])
    .map((d) => d.genericName.trim())
    .filter(Boolean);
  const fromTranscribe = (transcribe?.medicines ?? []).map((m) => m.trim()).filter(Boolean);
  const names = fromValidation.length ? fromValidation : fromTranscribe;
  return [...new Set(names)];
}

function flaggedDosages(validation: PrescriptionValidationResult | null) {
  return (validation?.dosageFindings ?? []).filter((d) => d.status !== 'within_range');
}

function showValidationResults(validation: PrescriptionValidationResult | null): boolean {
  if (!validation) return false;
  return (
    validation.overallRiskLevel !== 'none'
    || validation.interactionFindings.length > 0
    || flaggedDosages(validation).length > 0
    || validation.unrecognizedDrugs.length > 0
    || extractedMedicines(validation, null).length > 0
    || Boolean(validation.llmSummary?.trim())
  );
}

export function DoctorPrescriptionValidateScreen() {
  const { t } = useTranslation();
  const abortRef = useRef<AbortController | null>(null);
  const [pendingFile, setPendingFile] = useState<PickedPrescriptionFile | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<PrescriptionValidationResult | null>(null);
  const [transcribeError, setTranscribeError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [streamPhase, setStreamPhase] = useState('');
  const [transcribeResult, setTranscribeResult] = useState<DoctorPrescriptionTranscribeResult | null>(null);
  const [prescriptionSummary, setPrescriptionSummary] = useState('');
  const [summaryEditing, setSummaryEditing] = useState(false);

  const phaseLabel = useMemo(() => {
    const phase = streamPhase.trim();
    if (!phase) return t('dashboard.validatePrescription.reading');
    const key = `dashboard.validatePrescription.phase.${phase}`;
    const translated = t(key);
    return translated === key ? t('dashboard.validatePrescription.reading') : translated;
  }, [streamPhase, t]);

  const clearPending = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPendingFile(null);
    setValidation(null);
    setTranscribeError('');
    setValidationError('');
    setStreamPhase('');
    setTranscribeResult(null);
    setPrescriptionSummary('');
    setSummaryEditing(false);
    setTranscribing(false);
    setValidating(false);
  }, []);

  const runTranscription = useCallback(async (file: PickedPrescriptionFile) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTranscribing(true);
    setTranscribeError('');
    setValidationError('');
    setValidation(null);
    setStreamPhase('');
    setTranscribeResult(null);
    setPrescriptionSummary('');
    setSummaryEditing(false);

    try {
      const result = await postDoctorPrescriptionTranscribeUploadStream(
        file,
        {
          onStatus: (phase) => setStreamPhase(phase),
          onTranscribed: (preview) => {
            if (preview.summary) setPrescriptionSummary(preview.summary);
          },
          onComplete: (row) => {
            setTranscribeResult(row);
            setPrescriptionSummary((prev) => row.summary?.trim() || prev);
          }
        },
        controller.signal
      );
      if (!result?.summary?.trim()) {
        setTranscribeError(t('dashboard.validatePrescription.transcribeFailed'));
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setTranscribeError(toUserFacingApiError(err, t('dashboard.validatePrescription.transcribeFailed')));
    } finally {
      if (abortRef.current === controller) {
        setTranscribing(false);
        setStreamPhase('');
        abortRef.current = null;
      }
    }
  }, [t]);

  const runValidation = useCallback(async () => {
    if (!prescriptionSummary.trim()) {
      setValidationError(t('dashboard.validatePrescription.summaryRequired'));
      return;
    }
    setValidating(true);
    setValidationError('');
    setValidation(null);
    try {
      const result = await validateDoctorPrescriptionFromSummary({
        prescriptionSummary,
        childWeightKg: transcribeResult?.childWeightKg ?? null,
        childAgeMonths: transcribeResult?.childAgeMonths ?? null,
        temperatureF: transcribeResult?.temperatureF ?? null,
        weightSource: transcribeResult?.weightSource
      });
      if (!result) {
        setValidationError(t('dashboard.validatePrescription.failed'));
      } else {
        setValidation(result);
      }
    } catch (err) {
      setValidationError(toUserFacingApiError(err, t('dashboard.validatePrescription.failed')));
    } finally {
      setValidating(false);
    }
  }, [prescriptionSummary, t, transcribeResult]);

  const onPickLibrary = useCallback(async () => {
    setTranscribeError('');
    try {
      const files = await pickPrescriptionImagesFromLibrary(1);
      const file = files[0];
      if (!file) return;
      setPendingFile(file);
      await runTranscription(file);
    } catch (err) {
      setTranscribeError(toUserFacingApiError(err, t('dashboard.validatePrescription.transcribeFailed')));
    }
  }, [runTranscription, t]);

  const onCapture = useCallback(async () => {
    setTranscribeError('');
    try {
      const file = await capturePrescriptionPhoto();
      if (!file) return;
      setPendingFile(file);
      await runTranscription(file);
    } catch (err) {
      setTranscribeError(toUserFacingApiError(err, t('dashboard.validatePrescription.transcribeFailed')));
    }
  }, [runTranscription, t]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const medicines = extractedMedicines(validation, transcribeResult);
  const badgeStyle = validation ? riskBadgeStyle(validation.overallRiskLevel) : null;
  const hasSummary = prescriptionSummary.trim().length > 0;
  const busy = transcribing || validating;

  return (
    <KeyboardSafeView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={sharedStyles.title}>{t('dashboard.validatePrescription.title')}</Text>
        <Text style={[sharedStyles.subtitle, styles.intro]}>{t('dashboard.validatePrescription.intro')}</Text>

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryBtn} onPress={() => void onPickLibrary()} disabled={busy}>
            <Text style={styles.secondaryBtnText}>{t('dashboard.validatePrescription.attachFile')}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => void onCapture()} disabled={busy}>
            <Text style={styles.secondaryBtnText}>{t('dashboard.validatePrescription.attachCamera')}</Text>
          </Pressable>
        </View>

        {pendingFile ? (
          <View style={styles.attachedRow}>
            <Text style={styles.attachedText}>
              {t('dashboard.validatePrescription.attachedFile', { name: pendingFile.name })}
            </Text>
            <Pressable onPress={clearPending} disabled={busy}>
              <Text style={styles.removeLink}>{t('dashboard.validatePrescription.removeFile')}</Text>
            </Pressable>
          </View>
        ) : null}

        {transcribeError ? <Text style={sharedStyles.errorText}>{transcribeError}</Text> : null}
        {validationError ? <Text style={sharedStyles.errorText}>{validationError}</Text> : null}

        {transcribing ? (
          <View style={styles.statusCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.statusText}>{phaseLabel}</Text>
          </View>
        ) : null}

        {!transcribing && hasSummary ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.sectionTitle}>{t('dashboard.validatePrescription.summaryTitle')}</Text>
              <Pressable
                style={styles.editBtn}
                onPress={() => setSummaryEditing((v) => !v)}
                accessibilityLabel={t('dashboard.validatePrescription.editSummary')}
              >
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={styles.editBtnText}>
                  {summaryEditing
                    ? t('dashboard.validatePrescription.doneEditing')
                    : t('dashboard.validatePrescription.editSummary')}
                </Text>
              </Pressable>
            </View>

            {summaryEditing ? (
              <TextInput
                style={styles.summaryInput}
                value={prescriptionSummary}
                onChangeText={setPrescriptionSummary}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.summaryText}>{prescriptionSummary}</Text>
            )}

            <Pressable
              style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
              disabled={busy}
              onPress={() => void runValidation()}
            >
              {validating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{t('dashboard.validatePrescription.action')}</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {!validating && validation && showValidationResults(validation) ? (
          <View style={styles.resultCard}>
            {badgeStyle ? (
              <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }]}>
                <Text style={[styles.badgeText, { color: badgeStyle.color }]}>
                  {t(`prescriptionSafety.risk.${validation.overallRiskLevel}`)}
                </Text>
              </View>
            ) : null}

            {medicines.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('dashboard.validatePrescription.medicinesFound')}</Text>
                <Text style={styles.bodyText}>{medicines.join(', ')}</Text>
              </View>
            ) : null}

            {validation.childWeightKgUsed != null ||
            validation.temperatureFUsed != null ||
            validation.childAgeMonthsUsed != null ? (
              <View style={styles.vitalsCard}>
                <Text style={styles.sectionTitle}>{t('dashboard.validatePrescription.vitalsFound')}</Text>
                {validation.childWeightKgUsed != null ? (
                  <Text style={styles.bodyText}>
                    {t('dashboard.validatePrescription.weightLabel', { value: validation.childWeightKgUsed })}
                  </Text>
                ) : null}
                {validation.temperatureFUsed != null ? (
                  <Text style={styles.bodyText}>
                    {t('dashboard.validatePrescription.temperatureLabel', { value: validation.temperatureFUsed })}
                  </Text>
                ) : null}
                {validation.childAgeMonthsUsed != null ? (
                  <Text style={styles.bodyText}>
                    {t('dashboard.validatePrescription.ageLabel', { value: validation.childAgeMonthsUsed })}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {validation.childWeightKgUsed == null && validation.weightSource === 'not_available' ? (
              <Text style={styles.hintText}>{t('dashboard.validatePrescription.noWeightHint')}</Text>
            ) : null}

            {validation.llmSummary ? <Text style={styles.bodyText}>{validation.llmSummary}</Text> : null}

            {validation.interactionFindings.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('prescriptionSafety.interactions')}</Text>
                {validation.interactionFindings.map((item, idx) => (
                  <View key={`${item.drugA}-${item.drugB}-${idx}`} style={styles.findingCard}>
                    <Text style={styles.findingTitle}>
                      {item.drugA} + {item.drugB}
                    </Text>
                    {item.severity ? <Text style={styles.metaText}>{item.severity}</Text> : null}
                    {item.clinicalEffect ? <Text style={styles.bodyText}>{item.clinicalEffect}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {validation.dosageFindings.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('prescriptionSafety.dosage')}</Text>
                {validation.dosageFindings.map((item, idx) => (
                  <View key={`${item.genericName}-${idx}`} style={styles.findingCard}>
                    <Text style={styles.findingTitle}>{item.genericName}</Text>
                    {item.message ? <Text style={styles.bodyText}>{item.message}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {validation.unrecognizedDrugs.length ? (
              <Text style={styles.bodyText}>
                {t('prescriptionSafety.unrecognized', { drugs: validation.unrecognizedDrugs.join(', ') })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!validating && validation && !showValidationResults(validation) ? (
          <View style={styles.okCard}>
            <Text style={styles.okText}>{t(`prescriptionSafety.risk.${validation.overallRiskLevel}`)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 16,
    paddingBottom: TAB_SCROLL_BOTTOM_PADDING
  },
  intro: {
    marginBottom: 16
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  secondaryBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  attachedRow: {
    marginBottom: 12
  },
  attachedText: {
    fontSize: 12,
    color: colors.textMuted
  },
  removeLink: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    marginTop: 8
  },
  statusText: {
    fontSize: 14,
    color: colors.textMuted,
    flex: 1
  },
  summaryCard: {
    marginTop: 12,
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
  },
  summaryText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20
  },
  summaryInput: {
    minHeight: 180,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 10,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 180,
    alignItems: 'center'
  },
  primaryBtnDisabled: {
    opacity: 0.6
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },
  resultCard: {
    marginTop: 12,
    gap: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  section: {
    gap: 8
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  bodyText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase'
  },
  vitalsCard: {
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    padding: 10,
    gap: 4
  },
  hintText: {
    fontSize: 12,
    color: '#92400e'
  },
  findingCard: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 10,
    gap: 4
  },
  findingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  okCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    padding: 14
  },
  okText: {
    fontSize: 14,
    color: '#065f46'
  }
});
