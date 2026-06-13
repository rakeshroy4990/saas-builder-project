import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  fetchGrowthChartContextMobile,
  listChildProfilesMobile,
  saveGrowthRecordMobile,
  type GrowthMetric
} from '@/features/growth/growthApi';
import {
  BMI_PERCENTILE_DISPLAY_MIN,
  GROWTH_METRICS,
  METRIC_GUIDE_KEYS,
  METRIC_LABEL_KEYS,
  formatBmiPercentileDisplay,
  formatPercentileDisplay,
  isValidDateInput,
  parseGrowthRecords,
  percentileBadgeColors,
  recordedDateToIso,
  sortRecordsDesc,
  todayDateInput
} from '@/features/growth/growthHelpers';
import { growthStyles } from '@/features/growth/growthStyles';
import { sharedStyles } from '@/theme/styles';

function pickArray(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const envelope = data as Record<string, unknown>;
  const rows = envelope.Data;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function pickObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;
  const envelope = data as Record<string, unknown>;
  const row = envelope.Data;
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : null;
}

function CollapsiblePanel({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={growthStyles.panelMuted}>
      <Pressable onPress={onToggle} style={growthStyles.collapsibleTrigger}>
        <Text style={growthStyles.collapsibleTitle}>{title}</Text>
        <Text style={growthStyles.collapsibleChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? <View style={growthStyles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

export function GrowthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Record<string, unknown>[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [metric, setMetric] = useState<GrowthMetric>('wfa');
  const [chart, setChart] = useState<Record<string, unknown> | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCircCm, setHeadCircCm] = useState('');
  const [recordedDate, setRecordedDate] = useState(todayDateInput());
  const [metricGuideOpen, setMetricGuideOpen] = useState(true);
  const [referenceGuideOpen, setReferenceGuideOpen] = useState(false);

  const selectedChild = useMemo(
    () => children.find((child) => String(child.ExternalId ?? '') === selectedChildId) ?? null,
    [children, selectedChildId]
  );

  const historyRecords = useMemo(
    () => sortRecordsDesc(parseGrowthRecords(chart?.Records)),
    [chart]
  );

  async function loadChildren() {
    setLoading(true);
    try {
      const body = await listChildProfilesMobile();
      const rows = pickArray(body);
      setChildren(rows);
      if (!selectedChildId && rows[0]?.ExternalId) {
        setSelectedChildId(String(rows[0].ExternalId));
      }
    } catch {
      Alert.alert(t('growth.title'), t('growth.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadChart(childId: string, selectedMetric: GrowthMetric) {
    if (!childId) return;
    setLoading(true);
    try {
      const body = await fetchGrowthChartContextMobile(childId, selectedMetric);
      setChart(pickObject(body));
    } catch {
      Alert.alert(t('growth.title'), t('growth.chartFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChildren();
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      void loadChart(selectedChildId, metric);
    }
  }, [selectedChildId, metric]);

  async function saveReading() {
    if (!selectedChildId) return;
    const weight = weightKg.trim() ? Number(weightKg) : null;
    const height = heightCm.trim() ? Number(heightCm) : null;
    const headCirc = headCircCm.trim() ? Number(headCircCm) : null;
    if (weight == null && height == null && headCirc == null) {
      Alert.alert(t('growth.title'), t('growth.entryRequired'));
      return;
    }

    const dateValue = recordedDate.trim() || todayDateInput();
    if (!isValidDateInput(dateValue)) {
      Alert.alert(t('growth.title'), t('growth.invalidDate'));
      return;
    }
    if (dateValue > todayDateInput()) {
      Alert.alert(t('growth.title'), t('growth.dateFuture'));
      return;
    }
    const dob = selectedChild ? String(selectedChild.DateOfBirth ?? '') : '';
    if (dob && dateValue < dob) {
      Alert.alert(t('growth.title'), t('growth.dateBeforeDob'));
      return;
    }

    setLoading(true);
    try {
      await saveGrowthRecordMobile({
        ChildProfileExternalId: selectedChildId,
        RecordedAt: recordedDateToIso(dateValue),
        WeightKg: weight,
        HeightCm: height,
        HeadCircumferenceCm: headCirc,
        Source: 'manual'
      });
      setWeightKg('');
      setHeightCm('');
      setHeadCircCm('');
      setRecordedDate(todayDateInput());
      await loadChart(selectedChildId, metric);
    } catch {
      Alert.alert(t('growth.title'), t('growth.saveFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[sharedStyles.screenPadded, { paddingBottom: 32, gap: 16 }]}>
      <View>
        <Text style={sharedStyles.title}>{t('growth.title')}</Text>
        <Text style={[sharedStyles.subtitle, { marginTop: 4 }]}>{t('growth.intro')}</Text>
        <View style={growthStyles.recordingCadence} accessibilityRole="text">
          <Text style={growthStyles.recordingCadenceTitle}>{t('growth.recordingCadenceTitle')}</Text>
          <Text style={growthStyles.recordingCadenceBody}>{t('growth.recordingCadenceBody')}</Text>
        </View>
        <Text style={[growthStyles.hint, { fontStyle: 'italic', marginTop: 8 }]}>{t('growth.disclaimer')}</Text>
      </View>

      {children.map((child) => {
        const id = String(child.ExternalId ?? '');
        const selected = id === selectedChildId;
        return (
          <Pressable
            key={id}
            onPress={() => setSelectedChildId(id)}
            style={[
              growthStyles.childCard,
              selected ? growthStyles.childCardSelected : growthStyles.childCardDefault
            ]}
          >
            <Text style={growthStyles.childName}>{String(child.DisplayName ?? '')}</Text>
          </Pressable>
        );
      })}

      {selectedChildId ? (
        <>
          <CollapsiblePanel
            title={t('growth.metricGuide.title')}
            open={metricGuideOpen}
            onToggle={() => setMetricGuideOpen((value) => !value)}
          >
            {GROWTH_METRICS.map((m) => (
              <View
                key={m}
                style={[growthStyles.guideItem, metric === m ? growthStyles.guideItemActive : null]}
              >
                <Text style={growthStyles.guideItemLabel}>{t(METRIC_LABEL_KEYS[m])}</Text>
                <Text style={growthStyles.guideItemText}>{t(METRIC_GUIDE_KEYS[m])}</Text>
              </View>
            ))}
          </CollapsiblePanel>

          <View style={growthStyles.metricRow}>
            {GROWTH_METRICS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMetric(m)}
                style={[
                  growthStyles.metricPill,
                  metric === m ? growthStyles.metricPillActive : growthStyles.metricPillInactive
                ]}
              >
                <Text style={metric === m ? growthStyles.metricPillTextActive : growthStyles.metricPillTextInactive}>
                  {t(METRIC_LABEL_KEYS[m])}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={growthStyles.actionRow}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/device-read',
                  params: { childId: selectedChildId }
                } as never)
              }
              style={[sharedStyles.buttonSecondary, { flexGrow: 1, minWidth: 140 }]}
            >
              <Text style={sharedStyles.buttonSecondaryText}>{t('devices.ble.connect')}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/vitals-trend',
                  params: { childId: selectedChildId }
                } as never)
              }
              style={[sharedStyles.buttonSecondary, { flexGrow: 1, minWidth: 140 }]}
            >
              <Text style={sharedStyles.buttonSecondaryText}>{t('vitals.title')}</Text>
            </Pressable>
          </View>

          <CollapsiblePanel
            title={t('growth.chart.referenceLinesTitle')}
            open={referenceGuideOpen}
            onToggle={() => setReferenceGuideOpen((value) => !value)}
          >
            <Text style={growthStyles.calloutLine}>
              <Text style={growthStyles.calloutStrong}>{t('growth.chart.legendP50')}: </Text>
              {t('growth.chart.p50Importance')}
            </Text>
            <Text style={growthStyles.calloutLine}>
              <Text style={growthStyles.calloutStrong}>{t('growth.chart.legendP3')}: </Text>
              {t('growth.chart.p3Importance')}
            </Text>
            <Text style={growthStyles.calloutLine}>
              <Text style={growthStyles.calloutStrong}>{t('growth.chart.legendP97')}: </Text>
              {t('growth.chart.p97Importance')}
            </Text>
          </CollapsiblePanel>

          {loading ? <Text style={sharedStyles.subtitle}>{t('growth.loading')}</Text> : null}

          {historyRecords.length > 0 ? (
            <View style={growthStyles.panel}>
              <Text style={growthStyles.sectionTitle}>{t('growth.history')}</Text>
              {historyRecords.map((record) => {
                const weightColors = percentileBadgeColors(record.weightPercentile, 'weight');
                const heightColors = percentileBadgeColors(record.heightPercentile, 'height');
                const bmiColors = percentileBadgeColors(record.bmiPercentile, 'bmi');
                return (
                  <View key={record.externalId || record.recordedAt} style={growthStyles.historyRow}>
                    <Text style={growthStyles.historyDate}>
                      {record.recordedAt ? new Date(record.recordedAt).toLocaleDateString() : '—'}
                    </Text>
                    <Text style={growthStyles.historyValues}>
                      {record.weightKg != null ? `${record.weightKg} kg` : ''}
                      {record.heightCm != null ? ` · ${record.heightCm} cm` : ''}
                      {record.headCircumferenceCm != null ? ` · ${record.headCircumferenceCm} cm HC` : ''}
                    </Text>
                    <Text style={growthStyles.percentileHeading}>{t('growth.historyPercentiles')}</Text>
                    <View style={growthStyles.percentileBadges}>
                      {record.weightKg != null ? (
                        <View style={[growthStyles.percentileBadge, { backgroundColor: weightColors.backgroundColor }]}>
                          <Text style={growthStyles.percentileBadgeLabel}>{t('growth.historyWeightPct')}</Text>
                          <Text style={[growthStyles.percentileBadgeValue, { color: weightColors.color }]}>
                            {formatPercentileDisplay(record.weightPercentile)}
                          </Text>
                        </View>
                      ) : null}
                      {record.heightCm != null ? (
                        <View style={[growthStyles.percentileBadge, { backgroundColor: heightColors.backgroundColor }]}>
                          <Text style={growthStyles.percentileBadgeLabel}>{t('growth.historyHeightPct')}</Text>
                          <Text style={[growthStyles.percentileBadgeValue, { color: heightColors.color }]}>
                            {formatPercentileDisplay(record.heightPercentile)}
                          </Text>
                        </View>
                      ) : null}
                      {record.weightKg != null && record.heightCm != null ? (
                        <View style={[growthStyles.percentileBadge, { backgroundColor: bmiColors.backgroundColor }]}>
                          <Text style={growthStyles.percentileBadgeLabel}>{t('growth.historyBmiPct')}</Text>
                          <Text style={[growthStyles.percentileBadgeValue, { color: bmiColors.color }]}>
                            {formatBmiPercentileDisplay(record.bmiPercentile)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {record.bmiPercentile != null && record.bmiPercentile < BMI_PERCENTILE_DISPLAY_MIN ? (
                      <Text style={growthStyles.hint}>{t('growth.bmiPercentileHiddenHint')}</Text>
                    ) : null}
                  </View>
                );
              })}
              <View style={growthStyles.guidePanel}>
                <Text style={growthStyles.guidePanelTitle}>{t('growth.percentileGuide.title')}</Text>
                <Text style={growthStyles.guidePanelText}>{t('growth.percentileGuide.intro')}</Text>
                <Text style={growthStyles.guidePanelText}>{t('growth.percentileGuide.example')}</Text>
                <Text style={growthStyles.guidePanelText}>{t('growth.percentileGuide.positiveUse')}</Text>
                <Text style={growthStyles.guidePanelText}>{t('growth.percentileGuide.doctorVisit')}</Text>
                <Text style={growthStyles.guidePanelText}>{t('growth.percentileGuide.bmiNote')}</Text>
              </View>
            </View>
          ) : null}

          <View style={growthStyles.panel}>
            <Text style={growthStyles.sectionTitle}>{t('growth.manualEntry')}</Text>
            <Text style={sharedStyles.label}>{t('growth.recordedDate')}</Text>
            <TextInput
              value={recordedDate}
              onChangeText={setRecordedDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={sharedStyles.input}
            />
            <Text style={growthStyles.hint}>{t('growth.recordedDateHint')}</Text>
            <TextInput
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
              placeholder={t('growth.weightKg')}
              style={[sharedStyles.input, { marginTop: 10 }]}
            />
            <TextInput
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="decimal-pad"
              placeholder={t('growth.heightCm')}
              style={[sharedStyles.input, { marginTop: 8 }]}
            />
            <TextInput
              value={headCircCm}
              onChangeText={setHeadCircCm}
              keyboardType="decimal-pad"
              placeholder={t('growth.headCircCm')}
              style={[sharedStyles.input, { marginTop: 8 }]}
            />
            <Pressable onPress={() => void saveReading()} style={[sharedStyles.button, { marginTop: 12 }]}>
              <Text style={sharedStyles.buttonText}>{t('growth.saveReading')}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={sharedStyles.subtitle}>{t('growth.noChildYet')}</Text>
      )}
    </ScrollView>
  );
}
