import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  fetchGrowthChartContextMobile,
  fetchGrowthHistorySummaryMobile,
  listChildProfilesMobile,
  saveChildProfileMobile,
  saveGrowthRecordMobile,
  type GrowthMetric
} from '@/features/growth/growthApi';
import { GrowthChart } from '@/features/growth/GrowthChart';
import {
  childProfileFromRow,
  coalesceParentHeights,
  formatParentHeightInput,
  mergeChildProfileRow,
  type ChildProfileRow,
  type GrowthChartContext
} from '@/features/growth/growthChartContext';
import { resolveMidParentalHeight } from '@/features/growth/midParentalHeight';
import {
  GROWTH_METRICS,
  METRIC_GUIDE_KEYS,
  METRIC_LABEL_KEYS,
  formatAgeAtRecordingLabel,
  formatBmiKgM2,
  formatPercentileDisplay,
  isTallLeanGrowthPattern,
  isoToDateInput,
  isValidDateInput,
  percentileBadgeColors,
  recordedDateToIso,
  resolveGrowthCharacteristics,
  sortRecordsDesc,
  todayDateInput,
  type GrowthCharacteristics,
  type GrowthRecordRow
} from '@/features/growth/growthHelpers';
import { growthStyles } from '@/features/growth/growthStyles';
import { TAB_SCROLL_BOTTOM_PADDING } from '@/theme/layout';
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

function normalizeChildSex(value: unknown): 'male' | 'female' {
  return String(value ?? '').trim().toLowerCase() === 'female' ? 'female' : 'male';
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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [children, setChildren] = useState<Record<string, unknown>[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [showChildForm, setShowChildForm] = useState(false);
  const [editingChildId, setEditingChildId] = useState('');
  const [newChildName, setNewChildName] = useState('');
  const [newChildDob, setNewChildDob] = useState('');
  const [newChildSex, setNewChildSex] = useState<'male' | 'female'>('male');
  const [newMotherHeightCm, setNewMotherHeightCm] = useState('');
  const [newFatherHeightCm, setNewFatherHeightCm] = useState('');
  const [metric, setMetric] = useState<GrowthMetric>('wfa');
  const [chartContext, setChartContext] = useState<GrowthChartContext | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCircCm, setHeadCircCm] = useState('');
  const [recordedDate, setRecordedDate] = useState(todayDateInput());
  const [editingRecordId, setEditingRecordId] = useState('');
  const [metricGuideOpen, setMetricGuideOpen] = useState(false);
  const [referenceGuideOpen, setReferenceGuideOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [historySummaries, setHistorySummaries] = useState<Record<string, string>>({});
  const [historyCharacteristics, setHistoryCharacteristics] = useState<
    Record<string, GrowthCharacteristics>
  >({});
  const [summaryInflightIds, setSummaryInflightIds] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);
  const summaryInflightRef = useRef(new Set<string>());
  const historySummariesRef = useRef<Record<string, string>>({});
  const selectedChildIdRef = useRef(selectedChildId);
  selectedChildIdRef.current = selectedChildId;

  const selectedChildRow = useMemo(
    () =>
      children.find(
        (child) => String(child.ExternalId ?? child.externalId ?? '') === selectedChildId
      ) ?? null,
    [children, selectedChildId]
  );

  const resolvedChild = useMemo((): ChildProfileRow | null => {
    const fromList = childProfileFromRow(selectedChildRow);
    const fromChart = chartContext?.childProfile ?? null;
    const mph = chartContext?.midParentalHeight ?? null;
    if (!fromList && !fromChart) return null;
    if (!fromChart) return fromList ? { ...fromList, ...coalesceParentHeights(fromList, mph) } : null;
    if (!fromList) return { ...fromChart, ...coalesceParentHeights(fromChart, mph) };
    return {
      ...fromList,
      ...fromChart,
      ...coalesceParentHeights(
        {
          motherHeightCm: fromChart.motherHeightCm ?? fromList.motherHeightCm,
          fatherHeightCm: fromChart.fatherHeightCm ?? fromList.fatherHeightCm
        },
        mph
      )
    };
  }, [selectedChildRow, chartContext]);

  const historyRecords = useMemo(
    () => sortRecordsDesc(chartContext?.records ?? []),
    [chartContext]
  );

  const latestRecord = historyRecords[0] ?? null;

  const midParentalHeight = useMemo(() => {
    const mph = chartContext?.midParentalHeight ?? null;
    const heights = coalesceParentHeights(resolvedChild, mph);
    return resolveMidParentalHeight(
      mph,
      resolvedChild?.sex ?? 'male',
      heights.motherHeightCm,
      heights.fatherHeightCm
    );
  }, [chartContext, resolvedChild]);

  const geneticHeightComparison = useMemo((): 'above' | 'below' | 'on_track' | null => {
    if (metric !== 'lhfa' || !midParentalHeight?.complete) return null;
    const expected = midParentalHeight.expectedHeightAtAgeCm;
    const latestHeight = latestRecord?.heightCm ?? null;
    if (expected == null || latestHeight == null) return null;
    const delta = latestHeight - expected;
    if (Math.abs(delta) <= 1.5) return 'on_track';
    return delta > 0 ? 'above' : 'below';
  }, [metric, midParentalHeight, latestRecord]);

  const latestGrowthCharacteristics = useMemo(() => {
    if (!latestRecord) return null;
    const fromSummary = chartContext?.latestSummary?.characteristics ?? null;
    const cached = historyCharacteristics[latestRecord.externalId];
    return resolveGrowthCharacteristics(
      resolvedChild?.sex ?? null,
      latestRecord,
      t,
      cached ?? fromSummary ?? null
    );
  }, [latestRecord, chartContext, historyCharacteristics, resolvedChild, t]);

  async function loadChildren() {
    setLoading(true);
    setLoadError('');
    try {
      const body = await listChildProfilesMobile();
      const rows = pickArray(body);
      setChildren(rows);
      if (!selectedChildId && rows[0]?.ExternalId) {
        setSelectedChildId(String(rows[0].ExternalId));
      }
      if (rows.length === 0) {
        setShowChildForm(true);
        setEditingChildId('');
      }
    } catch {
      setLoadError(t('growth.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadChart(childId: string, selectedMetric: GrowthMetric) {
    if (!childId) return;
    setLoading(true);
    try {
      const ctx = await fetchGrowthChartContextMobile(childId, selectedMetric);
      setChildren((prev) => mergeChildProfileRow(prev, ctx.childProfile));
      setChartContext(ctx);
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

  useEffect(() => {
    historySummariesRef.current = historySummaries;
  }, [historySummaries]);

  useEffect(() => {
    setHistorySummaries({});
    setHistoryCharacteristics({});
    setSummaryInflightIds({});
    historySummariesRef.current = {};
    summaryInflightRef.current.clear();
  }, [selectedChildId]);

  useEffect(() => {
    setHistorySummaries({});
    setHistoryCharacteristics({});
    setSummaryInflightIds({});
    historySummariesRef.current = {};
    summaryInflightRef.current.clear();
    if (!selectedChildId || historyRecords.length === 0) return;

    const fetchChildId = selectedChildId;
    const childSex = resolvedChild?.sex ?? null;

    for (const record of historyRecords) {
      const id = record.externalId;
      if (!id || summaryInflightRef.current.has(id) || historySummariesRef.current[id]) {
        continue;
      }
      summaryInflightRef.current.add(id);
      setSummaryInflightIds((prev) => ({ ...prev, [id]: true }));
      let accumulated = '';
      void fetchGrowthHistorySummaryMobile(
        {
          ChildProfileExternalId: fetchChildId,
          AgeMonthsAtRecording: record.ageMonthsAtRecording,
          WeightKg: record.weightKg,
          HeightCm: record.heightCm,
          HeadCircumferenceCm: record.headCircumferenceCm,
          WeightPercentile: record.weightPercentile,
          HeightPercentile: record.heightPercentile,
          BmiPercentile: record.bmiPercentile,
          HcPercentile: record.hcPercentile,
          Sex: childSex
        },
        id,
        {
          onDelta: (chunk) => {
            if (fetchChildId !== selectedChildIdRef.current) return;
            accumulated += chunk;
            setHistorySummaries((prev) => ({ ...prev, [id]: accumulated }));
          },
          onComplete: (summary, characteristics) => {
            if (fetchChildId !== selectedChildIdRef.current) return;
            const text = (summary || accumulated).trim();
            if (text) {
              setHistorySummaries((prev) => ({ ...prev, [id]: text }));
            }
            if (characteristics?.phrase) {
              setHistoryCharacteristics((prev) => ({ ...prev, [id]: characteristics }));
            }
          }
        }
      )
        .then((result) => {
          if (fetchChildId !== selectedChildIdRef.current) return;
          const trimmed = result.summary.trim();
          if (trimmed) {
            setHistorySummaries((prev) => (prev[id] ? prev : { ...prev, [id]: trimmed }));
          }
          if (result.characteristics?.phrase) {
            setHistoryCharacteristics((prev) => ({ ...prev, [id]: result.characteristics! }));
          }
        })
        .finally(() => {
          summaryInflightRef.current.delete(id);
          setSummaryInflightIds((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        });
    }
  }, [historyRecords, selectedChildId, resolvedChild?.sex, i18n.language]);

  useEffect(() => {
    setHistorySummaries({});
    setHistoryCharacteristics({});
    setSummaryInflightIds({});
    historySummariesRef.current = {};
    summaryInflightRef.current.clear();
  }, [i18n.language]);

  function resetChildFormFields() {
    setNewChildName('');
    setNewChildDob('');
    setNewChildSex('male');
    setNewMotherHeightCm('');
    setNewFatherHeightCm('');
  }

  function startAddChild() {
    setEditingChildId('');
    resetChildFormFields();
    setShowChildForm(true);
  }

  function startEditChild() {
    if (!resolvedChild || !selectedChildId) return;
    setEditingChildId(selectedChildId);
    setNewChildName(resolvedChild.displayName);
    setNewChildDob(isoToDateInput(resolvedChild.dateOfBirth));
    setNewChildSex(normalizeChildSex(resolvedChild.sex));
    setNewMotherHeightCm(formatParentHeightInput(resolvedChild.motherHeightCm));
    setNewFatherHeightCm(formatParentHeightInput(resolvedChild.fatherHeightCm));
    setShowChildForm(true);
  }

  function cancelChildForm() {
    setShowChildForm(false);
    setEditingChildId('');
    resetChildFormFields();
  }

  async function saveChildProfile() {
    const name = newChildName.trim();
    const dob = newChildDob.trim();
    if (!name || !dob) {
      Alert.alert(t('growth.title'), t('growth.childInvalid'));
      return;
    }
    if (!isValidDateInput(dob)) {
      Alert.alert(t('growth.title'), t('growth.invalidDate'));
      return;
    }
    if (dob > todayDateInput()) {
      Alert.alert(t('growth.title'), t('growth.dateFuture'));
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const motherHeight = newMotherHeightCm.trim() ? Number(newMotherHeightCm) : null;
      const fatherHeight = newFatherHeightCm.trim() ? Number(newFatherHeightCm) : null;
      if (motherHeight != null && (motherHeight < 100 || motherHeight > 250)) {
        Alert.alert(t('growth.title'), t('growth.parentHeightInvalid'));
        setLoading(false);
        return;
      }
      if (fatherHeight != null && (fatherHeight < 100 || fatherHeight > 250)) {
        Alert.alert(t('growth.title'), t('growth.parentHeightInvalid'));
        setLoading(false);
        return;
      }
      const body = await saveChildProfileMobile({
        externalId: editingChildId || undefined,
        displayName: name,
        dateOfBirth: dob,
        sex: newChildSex,
        motherHeightCm: motherHeight,
        fatherHeightCm: fatherHeight
      });
      const saved = pickObject(body);
      const savedProfile = saved ? childProfileFromRow(saved) : null;
      const savedId = savedProfile?.externalId ?? editingChildId;
      cancelChildForm();
      await loadChildren();
      if (savedProfile) {
        setChildren((prev) => mergeChildProfileRow(prev, savedProfile));
      }
      if (savedId) {
        setSelectedChildId(savedId);
        if (motherHeight != null && fatherHeight != null) {
          setMetric('lhfa');
          await loadChart(savedId, 'lhfa');
        } else {
          await loadChart(savedId, metric);
        }
      }
    } catch {
      Alert.alert(t('growth.title'), t('growth.childSaveFailed'));
    } finally {
      setLoading(false);
    }
  }

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
    const dob = resolvedChild?.dateOfBirth ?? '';
    if (dob && dateValue < dob) {
      Alert.alert(t('growth.title'), t('growth.dateBeforeDob'));
      return;
    }

    setLoading(true);
    try {
      await saveGrowthRecordMobile({
        ExternalId: editingRecordId.trim() || null,
        ChildProfileExternalId: selectedChildId,
        RecordedAt: recordedDateToIso(dateValue),
        WeightKg: weight,
        HeightCm: height,
        HeadCircumferenceCm: headCirc,
        Source: 'manual'
      });
      clearEntryForm();
      await loadChart(selectedChildId, metric);
    } catch {
      Alert.alert(t('growth.title'), t('growth.saveFailed'));
    } finally {
      setLoading(false);
    }
  }

  function clearEntryForm() {
    setEditingRecordId('');
    setWeightKg('');
    setHeightCm('');
    setHeadCircCm('');
    setRecordedDate(todayDateInput());
  }

  function startEditRecord(record: GrowthRecordRow) {
    if (!record.externalId) return;
    setManualEntryOpen(true);
    setEditingRecordId(record.externalId);
    setWeightKg(record.weightKg != null ? String(record.weightKg) : '');
    setHeightCm(record.heightCm != null ? String(record.heightCm) : '');
    setHeadCircCm(record.headCircumferenceCm != null ? String(record.headCircumferenceCm) : '');
    setRecordedDate(isoToDateInput(record.recordedAt));
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={sharedStyles.screenPadded}
      contentContainerStyle={{ paddingBottom: TAB_SCROLL_BOTTOM_PADDING, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      <View>
        <Text style={sharedStyles.title}>{t('growth.title')}</Text>
        <Text style={[sharedStyles.subtitle, { marginTop: 4 }]}>{t('growth.intro')}</Text>
        <View style={growthStyles.recordingCadence} accessibilityRole="text">
          <Text style={growthStyles.recordingCadenceTitle}>{t('growth.recordingCadenceTitle')}</Text>
          <Text style={growthStyles.recordingCadenceBody}>{t('growth.recordingCadenceBody')}</Text>
        </View>
        <Text style={[growthStyles.hint, { fontStyle: 'italic', marginTop: 8 }]}>{t('growth.disclaimer')}</Text>
      </View>

      {loadError ? <Text style={[sharedStyles.subtitle, { color: '#b45309' }]}>{loadError}</Text> : null}
      {loading ? <Text style={sharedStyles.subtitle}>{t('growth.loading')}</Text> : null}

      {children.length > 0 ? (
        <>
          {children.map((child) => {
            const id = String(child.ExternalId ?? '');
            const selected = id === selectedChildId;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  clearEntryForm();
                  cancelChildForm();
                  setSelectedChildId(id);
                }}
                style={[
                  growthStyles.childCard,
                  selected ? growthStyles.childCardSelected : growthStyles.childCardDefault
                ]}
              >
                <Text style={growthStyles.childName}>{String(child.DisplayName ?? '')}</Text>
              </Pressable>
            );
          })}
          <View style={growthStyles.childActionRow}>
            <Pressable
              onPress={startAddChild}
              style={[sharedStyles.buttonSecondary, growthStyles.childActionButton]}
            >
              <Text style={sharedStyles.buttonSecondaryText}>{t('growth.addChild')}</Text>
            </Pressable>
            {selectedChildId ? (
              <Pressable
                onPress={startEditChild}
                style={[sharedStyles.buttonSecondary, growthStyles.childActionButton]}
              >
                <Text style={sharedStyles.buttonSecondaryText}>{t('growth.editChild')}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={sharedStyles.subtitle}>{t('growth.noChildYet')}</Text>
      )}

      {showChildForm ? (
        <View style={growthStyles.panelMuted}>
          <Text style={growthStyles.sectionTitle}>
            {t(editingChildId ? 'growth.editChildTitle' : 'growth.addChildTitle')}
          </Text>
          <Text style={sharedStyles.label}>{t('growth.childName')}</Text>
          <TextInput
            value={newChildName}
            onChangeText={setNewChildName}
            placeholder={t('growth.childName')}
            style={sharedStyles.input}
          />
          <Text style={[sharedStyles.label, { marginTop: 10 }]}>{t('growth.childDob')}</Text>
          <TextInput
            value={newChildDob}
            onChangeText={setNewChildDob}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={sharedStyles.input}
          />
          <Text style={[sharedStyles.label, { marginTop: 10 }]}>{t('growth.childSex')}</Text>
          <View style={[growthStyles.metricRow, { marginTop: 4 }]}>
            {(['male', 'female'] as const).map((sex) => (
              <Pressable
                key={sex}
                onPress={() => setNewChildSex(sex)}
                style={[
                  growthStyles.metricPill,
                  newChildSex === sex ? growthStyles.metricPillActive : growthStyles.metricPillInactive
                ]}
              >
                <Text
                  style={
                    newChildSex === sex ? growthStyles.metricPillTextActive : growthStyles.metricPillTextInactive
                  }
                >
                  {t(`growth.sex.${sex}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[sharedStyles.label, { marginTop: 10 }]}>{t('growth.motherHeightCm')}</Text>
          <TextInput
            value={newMotherHeightCm}
            onChangeText={setNewMotherHeightCm}
            placeholder={t('growth.motherHeightCm')}
            keyboardType="decimal-pad"
            style={sharedStyles.input}
          />
          <Text style={[sharedStyles.label, { marginTop: 10 }]}>{t('growth.fatherHeightCm')}</Text>
          <TextInput
            value={newFatherHeightCm}
            onChangeText={setNewFatherHeightCm}
            placeholder={t('growth.fatherHeightCm')}
            keyboardType="decimal-pad"
            style={sharedStyles.input}
          />
          <Text style={[growthStyles.hint, { marginTop: 8 }]}>{t('growth.parentHeightHint')}</Text>
          <View style={growthStyles.formActions}>
            <Pressable onPress={() => void saveChildProfile()} style={[sharedStyles.button, { flex: 1 }]}>
              <Text style={sharedStyles.buttonText}>
                {t(editingChildId ? 'growth.updateChild' : 'growth.saveChild')}
              </Text>
            </Pressable>
            <Pressable onPress={cancelChildForm} style={[sharedStyles.buttonSecondary, { flex: 1 }]}>
              <Text style={sharedStyles.buttonSecondaryText}>{t('growth.cancelEdit')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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

          <View style={[growthStyles.panel, growthStyles.geneticPanel]}>
            <Text style={growthStyles.geneticPanelTitle}>{t('growth.midParentalHeight.title')}</Text>
            {midParentalHeight?.complete ? (
              <>
                <Text style={growthStyles.geneticPanelHighlight}>
                  {t('growth.midParentalHeight.targetAdult', {
                    height: midParentalHeight.targetAdultHeightCm,
                    low: midParentalHeight.targetRangeLowCm,
                    high: midParentalHeight.targetRangeHighCm
                  })}
                </Text>
                {midParentalHeight.expectedHeightAtAgeCm != null ? (
                  <Text style={growthStyles.geneticPanelExpected}>
                    {t('growth.midParentalHeight.expectedAtAge', {
                      height: midParentalHeight.expectedHeightAtAgeCm,
                      months: Math.round(midParentalHeight.expectedHeightAgeMonths ?? 0)
                    })}
                  </Text>
                ) : null}
                {geneticHeightComparison === 'above' ? (
                  <Text style={growthStyles.geneticPanelCompare}>{t('growth.midParentalHeight.latestAboveGenetic')}</Text>
                ) : null}
                {geneticHeightComparison === 'below' ? (
                  <Text style={growthStyles.geneticPanelCompare}>{t('growth.midParentalHeight.latestBelowGenetic')}</Text>
                ) : null}
                {geneticHeightComparison === 'on_track' ? (
                  <Text style={growthStyles.geneticPanelCompare}>{t('growth.midParentalHeight.latestOnGenetic')}</Text>
                ) : null}
                <Text style={[growthStyles.hint, { marginTop: 8, color: '#0f766e' }]}>
                  {t('growth.midParentalHeight.note')}
                </Text>
                {metric !== 'lhfa' ? (
                  <Text style={[growthStyles.hint, { marginTop: 8, color: '#115e59', fontWeight: '700' }]}>
                    {t('growth.midParentalHeight.viewHeightChart')}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={growthStyles.guidePanelText}>{t('growth.midParentalHeight.incomplete')}</Text>
            )}
          </View>

          {chartContext ? (
            <View style={growthStyles.panel}>
              <GrowthChart
                metric={metric}
                records={chartContext.records}
                percentileCurves={chartContext.percentileCurves}
                geneticTargetCurve={midParentalHeight?.geneticTargetCurve ?? []}
                showGeneticLine={metric === 'lhfa' && Boolean(midParentalHeight?.complete)}
                geneticTargetMarker={
                  metric === 'lhfa' &&
                  midParentalHeight?.complete &&
                  midParentalHeight.expectedHeightAtAgeCm != null &&
                  midParentalHeight.expectedHeightAgeMonths != null
                    ? {
                        ageMonths: midParentalHeight.expectedHeightAgeMonths,
                        value: midParentalHeight.expectedHeightAtAgeCm
                      }
                    : null
                }
              />
            </View>
          ) : null}

          {metric === 'bfa' && latestRecord ? (
            <View style={growthStyles.panelMuted}>
              <Text style={growthStyles.sectionTitle}>{t('growth.chart.bmiContextTitle')}</Text>
              {latestGrowthCharacteristics?.phrase ? (
                <Text style={[growthStyles.guidePanelText, { fontWeight: '600', color: '#1e293b' }]}>
                  {t('growth.profilePhrase', { phrase: latestGrowthCharacteristics.phrase })}
                </Text>
              ) : null}
              {latestGrowthCharacteristics?.labels?.length ? (
                <View style={[growthStyles.percentileBadges, { marginTop: 8 }]}>
                  {latestGrowthCharacteristics.labels.map((label) => (
                    <View key={label} style={[growthStyles.percentileBadge, { backgroundColor: '#f1f5f9' }]}>
                      <Text style={growthStyles.percentileBadgeLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {formatBmiKgM2(latestRecord) ? (
                <Text style={[growthStyles.guidePanelText, { marginTop: 8 }]}>
                  {t('growth.chart.bmiValueLine', { bmi: formatBmiKgM2(latestRecord) })}
                </Text>
              ) : null}
              {isTallLeanGrowthPattern(latestRecord) ? (
                <Text style={growthStyles.hint}>
                  {t('growth.bmiTallLeanHint', { weightPct: Math.round(latestRecord.weightPercentile ?? 0) })}
                </Text>
              ) : latestRecord.bmiPercentile != null && latestRecord.bmiPercentile < 15 ? (
                <Text style={growthStyles.hint}>
                  {t('growth.chart.bmiContextHint', { weightPct: Math.round(latestRecord.weightPercentile ?? 0) })}
                </Text>
              ) : null}
            </View>
          ) : null}

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

          {historyRecords.length > 0 ? (
            <View style={growthStyles.panel}>
              <Text style={growthStyles.sectionTitle}>{t('growth.history')}</Text>
              {historyRecords.map((record) => {
                const weightColors = percentileBadgeColors(record.weightPercentile, 'weight');
                const heightColors = percentileBadgeColors(record.heightPercentile, 'height');
                const bmiColors = percentileBadgeColors(record.bmiPercentile, 'bmi');
                const childDob = resolvedChild?.dateOfBirth ?? '';
                const childSex = resolvedChild?.sex ?? '';
                const ageLabel = childDob
                  ? formatAgeAtRecordingLabel(childDob, record.recordedAt, t)
                  : null;
                const profilePhrase = resolveGrowthCharacteristics(
                  childSex,
                  record,
                  t,
                  historyCharacteristics[record.externalId] ?? null
                ).phrase;
                return (
                  <View
                    key={record.externalId || record.recordedAt}
                    style={[
                      growthStyles.historyRow,
                      editingRecordId === record.externalId ? growthStyles.historyRowEditing : null
                    ]}
                  >
                    <View style={growthStyles.historyRowHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={growthStyles.historyDate}>
                          {record.recordedAt ? new Date(record.recordedAt).toLocaleDateString() : '—'}
                        </Text>
                        {ageLabel ? <Text style={growthStyles.historyAge}>{ageLabel}</Text> : null}
                        <Text style={growthStyles.historyValues}>
                          {record.weightKg != null ? `${record.weightKg} kg` : ''}
                          {record.heightCm != null ? ` · ${record.heightCm} cm` : ''}
                          {formatBmiKgM2(record) ? ` · ${formatBmiKgM2(record)} ${t('growth.historyBmiUnit')}` : ''}
                          {record.headCircumferenceCm != null ? ` · ${record.headCircumferenceCm} cm HC` : ''}
                        </Text>
                      </View>
                      {record.externalId ? (
                        <Pressable
                          onPress={() => startEditRecord(record)}
                          style={[
                            growthStyles.editButton,
                            editingRecordId === record.externalId ? growthStyles.editButtonActive : null
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={t('growth.editReadingAria')}
                          accessibilityState={{ selected: editingRecordId === record.externalId }}
                        >
                          <Text style={growthStyles.editButtonText}>✎ {t('growth.editLabel')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
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
                            {formatPercentileDisplay(record.bmiPercentile)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {isTallLeanGrowthPattern(record) ? (
                      <Text style={growthStyles.hint}>
                        {t('growth.bmiTallLeanHint', { weightPct: Math.round(record.weightPercentile ?? 0) })}
                      </Text>
                    ) : record.bmiPercentile != null && record.bmiPercentile < 15 ? (
                      <Text style={growthStyles.hint}>
                        {t('growth.chart.bmiContextHint', { weightPct: Math.round(record.weightPercentile ?? 0) })}
                      </Text>
                    ) : null}
                    {profilePhrase ? (
                      <Text style={[growthStyles.historySummary, { fontWeight: '600', color: '#1e293b' }]}>
                        {t('growth.profilePhrase', { phrase: profilePhrase })}
                      </Text>
                    ) : null}
                    {historySummaries[record.externalId] ? (
                      <Text style={growthStyles.historySummary}>{historySummaries[record.externalId]}</Text>
                    ) : summaryInflightIds[record.externalId] ? (
                      <Text style={growthStyles.hint}>{t('growth.historySummaryLoading')}</Text>
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

          <CollapsiblePanel
            title={editingRecordId ? t('growth.editReading') : t('growth.manualEntry')}
            open={manualEntryOpen}
            onToggle={() => setManualEntryOpen((value) => !value)}
          >
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
              <Text style={sharedStyles.buttonText}>
                {editingRecordId ? t('growth.updateReading') : t('growth.saveReading')}
              </Text>
            </Pressable>
            {editingRecordId ? (
              <Pressable onPress={clearEntryForm} style={[sharedStyles.buttonSecondary, { marginTop: 8 }]}>
                <Text style={sharedStyles.buttonSecondaryText}>{t('growth.cancelEdit')}</Text>
              </Pressable>
            ) : null}
          </CollapsiblePanel>
        </>
      ) : null}
    </ScrollView>
  );
}
