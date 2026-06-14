import { useMemo, useState } from 'react';
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

import { toUserFacingApiError } from '@/api/apiErrors';
import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import {
  recommendDoctorPediatricDosage,
  type RecommendedDosageResult
} from '@/features/prescriptionSafety/doctorPrescriptionSafetyApi';
import { colors } from '@/theme/colors';
import { TAB_SCROLL_BOTTOM_PADDING } from '@/theme/layout';
import { sharedStyles } from '@/theme/styles';

function formatRange(range: number[] | null | undefined): string {
  if (!range?.length) return '—';
  if (range.length === 1) return `${range[0]} mg`;
  return `${range[0]}–${range[1]} mg`;
}

function formatFrequency(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return `${min}–${max}×/day`;
  const n = min ?? max;
  return n == null ? '—' : `${n}×/day`;
}

export function DoctorRecommendedDosageScreen() {
  const { t } = useTranslation();
  const [childAgeMonths, setChildAgeMonths] = useState('');
  const [childWeightKg, setChildWeightKg] = useState('');
  const [drugName, setDrugName] = useState('');
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendedDosageResult | null>(null);
  const [error, setError] = useState('');

  const parsedAgeMonths = useMemo(() => {
    const n = Number(childAgeMonths);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [childAgeMonths]);

  const parsedWeightKg = useMemo(() => {
    const n = Number(childWeightKg);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [childWeightKg]);

  const canRecommend = Boolean(drugName.trim()) && parsedAgeMonths != null && parsedWeightKg != null && !recommending;

  async function submitRecommendation() {
    if (!drugName.trim() || parsedAgeMonths == null || parsedWeightKg == null) {
      setError(t('dashboard.recommendedDosage.needsAllFields'));
      return;
    }
    setRecommending(true);
    setError('');
    setRecommendation(null);
    try {
      const result = await recommendDoctorPediatricDosage({
        drugName,
        childAgeMonths: parsedAgeMonths,
        childWeightKg: parsedWeightKg
      });
      setRecommendation(result);
      if (!result) {
        setError(t('dashboard.recommendedDosage.failed'));
      }
    } catch (err) {
      setError(toUserFacingApiError(err, t('dashboard.recommendedDosage.failed')));
    } finally {
      setRecommending(false);
    }
  }

  return (
    <KeyboardSafeView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={sharedStyles.title}>{t('dashboard.recommendedDosage.title')}</Text>
        <Text style={[sharedStyles.subtitle, styles.intro]}>{t('dashboard.recommendedDosage.intro')}</Text>

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>{t('dashboard.recommendedDosage.childAgeMonths')}</Text>
            <TextInput
              value={childAgeMonths}
              onChangeText={setChildAgeMonths}
              keyboardType="decimal-pad"
              placeholder={t('dashboard.recommendedDosage.childAgePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={sharedStyles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{t('dashboard.recommendedDosage.childWeightKg')}</Text>
            <TextInput
              value={childWeightKg}
              onChangeText={setChildWeightKg}
              keyboardType="decimal-pad"
              placeholder={t('dashboard.recommendedDosage.childWeightPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={sharedStyles.input}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('dashboard.recommendedDosage.drugName')}</Text>
          <TextInput
            value={drugName}
            onChangeText={setDrugName}
            placeholder={t('dashboard.recommendedDosage.drugNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={sharedStyles.input}
            autoCapitalize="none"
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, !canRecommend && styles.primaryBtnDisabled]}
          onPress={() => void submitRecommendation()}
          disabled={!canRecommend}
        >
          {recommending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('dashboard.recommendedDosage.action')}</Text>
          )}
        </Pressable>

        {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}

        {recommendation ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {recommendation.genericName || recommendation.extractedName}
            </Text>
            <Text style={styles.bodyText}>{recommendation.message}</Text>

            {recommendation.status === 'available' ? (
              <View style={styles.metricsGrid}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>{t('dashboard.recommendedDosage.expectedDose')}</Text>
                  <Text style={styles.metricValue}>{formatRange(recommendation.expectedDoseRangeMg)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>{t('dashboard.recommendedDosage.dosePerKg')}</Text>
                  <Text style={styles.metricValue}>
                    {recommendation.dosePerKgMg != null ? `${recommendation.dosePerKgMg} mg/kg` : '—'}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>{t('dashboard.recommendedDosage.maxDaily')}</Text>
                  <Text style={styles.metricValue}>
                    {recommendation.maxDailyDoseMg != null ? `${recommendation.maxDailyDoseMg} mg` : '—'}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>{t('dashboard.recommendedDosage.frequency')}</Text>
                  <Text style={styles.metricValue}>
                    {formatFrequency(recommendation.frequencyPerDayMin, recommendation.frequencyPerDayMax)}
                  </Text>
                </View>
              </View>
            ) : null}

            {recommendation.source ? (
              <Text style={styles.sourceText}>
                {t('dashboard.recommendedDosage.source', { source: recommendation.source })}
              </Text>
            ) : null}
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
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  field: {
    flex: 1,
    marginBottom: 12
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase'
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 160,
    alignItems: 'center'
  },
  primaryBtnDisabled: {
    opacity: 0.5
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
  },
  resultCard: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  bodyText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20
  },
  metricsGrid: {
    gap: 10
  },
  metric: {
    gap: 2
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase'
  },
  metricValue: {
    fontSize: 14,
    color: colors.text
  },
  sourceText: {
    fontSize: 12,
    color: colors.textMuted
  }
});
