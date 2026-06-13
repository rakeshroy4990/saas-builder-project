import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { analyzeTriage, fetchTriageForAppointmentId, isTriageFresh } from '@/features/triage/triageApi';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type Step = 'form' | 'loading' | 'result';
type TriageFrequency = 'CONSTANT' | 'FEW_TIMES_PER_DAY' | 'ONCE_PER_DAY' | 'INTERMITTENT';

const FREQUENCY_OPTIONS: TriageFrequency[] = ['CONSTANT', 'FEW_TIMES_PER_DAY', 'ONCE_PER_DAY', 'INTERMITTENT'];

function parseSymptomInput(text: string): string[] {
  return text
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function buildAnalyzeNotes(
  t: (key: string) => string,
  frequency: TriageFrequency,
  symptomBrief?: string
): string {
  const parts = [`${t('triage.frequency.notePrefix')}: ${t(`triage.frequency.${frequency}`)}`];
  const brief = String(symptomBrief ?? '').trim();
  if (brief) {
    parts.push(`${t('triage.symptomBrief.notePrefix')}: ${brief.slice(0, 500)}`);
  }
  return parts.join('\n');
}

export function TriageScreen({ appointmentId }: { appointmentId?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('form');
  const [childAgeMonths, setChildAgeMonths] = useState('');
  const [symptomText, setSymptomText] = useState('');
  const [symptomFrequency, setSymptomFrequency] = useState<TriageFrequency | ''>('');
  const [symptomBrief, setSymptomBrief] = useState('');
  const [streamPhase, setStreamPhase] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof analyzeTriage>> | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      analyzeTriage(payload, {
        onStatus: (phase) => setStreamPhase(phase)
      }),
    onSuccess: (row) => {
      setStreamPhase('');
      setResult(row);
      setStep('result');
      if (appointmentId) {
        queryClient.invalidateQueries({ queryKey: ['triage', appointmentId] });
      }
    },
    onError: () => {
      setStreamPhase('');
      setStep('form');
    }
  });

  function submitAnalyze() {
    const age = Number(childAgeMonths);
    if (!Number.isFinite(age) || age < 0) {
      Alert.alert(t('triage.title'), t('triage.errors.ageRequired'));
      return;
    }

    const reportedSymptoms = parseSymptomInput(symptomText);
    if (!reportedSymptoms.length) {
      Alert.alert(t('triage.title'), t('triage.errors.symptomRequired'));
      return;
    }

    if (!symptomFrequency) {
      Alert.alert(t('triage.title'), t('triage.errors.frequencyRequired'));
      return;
    }

    setStep('loading');
    setStreamPhase('');
    analyzeMutation.mutate({
      ChildAgeMonths: age,
      ReportedSymptoms: reportedSymptoms,
      SymptomSeverity: 'MILD',
      AdditionalNotes: buildAnalyzeNotes(t, symptomFrequency, symptomBrief)
    });
  }

  return (
    <ScrollView style={sharedStyles.screenPadded} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={sharedStyles.title}>{t('triage.title')}</Text>
      <Text style={[sharedStyles.subtitle, { marginTop: 8 }]}>{t('triage.disclaimer')}</Text>

      {step === 'form' ? (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Text style={sharedStyles.label}>{t('triage.ageMonths')}</Text>
          <TextInput
            placeholder={t('triage.ageMonths')}
            keyboardType="number-pad"
            value={childAgeMonths}
            onChangeText={setChildAgeMonths}
            style={sharedStyles.input}
          />
          <Text style={sharedStyles.label}>{t('triage.symptomsLabel')}</Text>
          <TextInput
            placeholder={t('triage.symptomPlaceholder')}
            value={symptomText}
            onChangeText={setSymptomText}
            style={sharedStyles.input}
          />
          <Text style={sharedStyles.label}>{t('triage.frequency.label')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FREQUENCY_OPTIONS.map((value) => {
              const selected = symptomFrequency === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setSymptomFrequency(value)}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : colors.surface,
                    paddingHorizontal: 14,
                    paddingVertical: 8
                  }}
                >
                  <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                    {t(`triage.frequency.${value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={sharedStyles.label}>
            {t('triage.symptomBrief.label')} {t('triage.symptomBrief.optional')}
          </Text>
          <TextInput
            placeholder={t('triage.symptomBrief.placeholder')}
            value={symptomBrief}
            onChangeText={setSymptomBrief}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            style={[sharedStyles.input, { minHeight: 88 }]}
          />
          <Pressable style={sharedStyles.button} onPress={submitAnalyze}>
            <Text style={sharedStyles.buttonText}>{t('triage.analyze')}</Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'loading' ? (
        <Text style={{ marginTop: 24 }}>
          {streamPhase ? t(`triage.streamPhase.${streamPhase}`, { defaultValue: t('triage.analyzing') }) : t('triage.analyzing')}
        </Text>
      ) : null}

      {step === 'result' && result ? (
        <View style={{ marginTop: 16, gap: 12 }}>
          <View style={[sharedStyles.card, { borderColor: colors.primary }]}>
            <Text style={sharedStyles.subtitle}>{result.urgencyLevel.replace('_', ' ')}</Text>
            <Text style={{ marginTop: 8, color: colors.text }}>{result.urgencyReasoning}</Text>
          </View>
          {result.urgencyLevel === 'EMERGENCY' ? (
            <Pressable style={sharedStyles.button} onPress={() => Linking.openURL('tel:108')}>
              <Text style={sharedStyles.buttonText}>{t('triage.callEmergency')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

export function useAppointmentTriage(appointmentId?: string) {
  return useQuery({
    queryKey: ['triage', appointmentId],
    enabled: Boolean(appointmentId),
    queryFn: () => fetchTriageForAppointmentId(String(appointmentId)),
    staleTime: 0
  });
}

export function appointmentNeedsTriageSoftBlock(row: { createdAt?: string | null } | null | undefined): boolean {
  return !isTriageFresh(row?.createdAt);
}
