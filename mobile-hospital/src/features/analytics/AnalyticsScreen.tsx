import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';

import { useSessionStore } from '@/auth/sessionStore';
import { fetchAnalyticsCsvMobile } from '@/features/analytics/analyticsApi';
import { useAnalyticsDoctors, useAnalyticsOverview } from '@/features/analytics/useAnalytics';
import { colors } from '@/theme/colors';
import { TAB_SCROLL_BOTTOM_PADDING } from '@/theme/layout';

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function pickStr(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function shiftRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function AnalyticsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();
  const userId = String(useSessionStore((s) => s.user?.userId ?? '')).trim();
  const [range, setRange] = useState(shiftRange(30));
  const [doctorFilter, setDoctorFilter] = useState<{ id: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  const scopedDoctorId = role === 'DOCTOR' ? userId : doctorFilter?.id;
  const overviewQuery = useAnalyticsOverview(range.from, range.to, scopedDoctorId);
  const doctorsQuery = useAnalyticsDoctors(range.from, range.to);

  const overview = (overviewQuery.data ?? {}) as Record<string, unknown>;
  const summary = (overview.SummaryStats ?? overview.summaryStats ?? {}) as Record<string, unknown>;
  const previous = (overview.PreviousPeriod ?? overview.previousPeriod ?? {}) as Record<string, unknown>;
  const dailyTrend = useMemo(() => {
    const raw = overview.DailyTrend ?? overview.dailyTrend;
    return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  }, [overview]);
  const heatmap = useMemo(() => {
    const raw = overview.Heatmap ?? overview.heatmap;
    return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  }, [overview]);
  const retention = (overview.Retention ?? overview.retention ?? {}) as Record<string, unknown>;
  const doctors = useMemo(() => {
    const raw = doctorsQuery.data;
    return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  }, [doctorsQuery.data]);

  const maxTrend = dailyTrend.reduce(
    (m, row) => Math.max(m, pickNum(row, ['TotalScheduled', 'totalScheduled'])),
    1
  );

  async function exportCsv(type: 'appointments' | 'patients' | 'retention') {
    setExporting(true);
    try {
      const csv = await fetchAnalyticsCsvMobile(type, {
        from: range.from,
        to: range.to,
        doctorId: scopedDoctorId || undefined
      });
      if (!cacheDirectory) {
        Alert.alert(t('analytics.exportTitle'), t('analytics.exportUnavailable'));
        return;
      }
      const path = `${cacheDirectory}agastya_${type}_${range.to}.csv`;
      await writeAsStringAsync(path, csv, { encoding: EncodingType.UTF8 });
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/csv',
          dialogTitle: t('analytics.exportTitle')
        });
      } else {
        Alert.alert(t('analytics.exportTitle'), t('analytics.exportUnavailable'));
      }
    } catch {
      Alert.alert(t('analytics.exportTitle'), t('analytics.exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  if (role !== 'ADMIN' && role !== 'DOCTOR') {
    return (
      <View style={styles.centered}>
        <Text>{t('analytics.forbidden')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('analytics.title')}</Text>
        <Pressable style={styles.exportBtn} disabled={exporting} onPress={() => exportCsv('appointments')}>
          {exporting ? <ActivityIndicator size="small" /> : <Text style={styles.exportText}>{t('analytics.export')}</Text>}
        </Pressable>
      </View>

      {doctorFilter ? (
        <Pressable onPress={() => setDoctorFilter(null)}>
          <Text style={styles.filterPill}>{t('analytics.viewingDoctor', { name: doctorFilter.name })} ✕</Text>
        </Pressable>
      ) : null}

      <View style={styles.pillRow}>
        {(['7d', '30d', '90d'] as const).map((preset) => (
          <Pressable
            key={preset}
            style={styles.pill}
            onPress={() => setRange(shiftRange(preset === '7d' ? 7 : preset === '90d' ? 90 : 30))}
          >
            <Text style={styles.pillText}>{preset.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      {overviewQuery.isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.cardGrid}>
            {[
              { label: t('analytics.cards.appointments'), value: pickNum(summary, ['TotalAppointments', 'totalAppointments']), prev: pickNum(previous, ['TotalAppointments', 'totalAppointments']) },
              { label: t('analytics.cards.completion'), value: pickNum(summary, ['CompletionRatePct', 'completionRatePct']), prev: pickNum(previous, ['CompletionRatePct', 'completionRatePct']), suffix: '%' },
              { label: t('analytics.cards.patients'), value: pickNum(summary, ['TotalUniquePatients', 'totalUniquePatients']), prev: pickNum(previous, ['TotalUniquePatients', 'totalUniquePatients']) },
              { label: t('analytics.cards.returnRate'), value: pickNum(summary, ['ReturnRatePct', 'returnRatePct']), prev: pickNum(previous, ['ReturnRatePct', 'returnRatePct']), suffix: '%' }
            ].map((card) => {
              const delta = card.prev > 0 ? Math.round(((card.value - card.prev) / card.prev) * 100) : null;
              return (
                <View key={card.label} style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {card.value}
                    {card.suffix ?? ''}
                  </Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                  {delta != null ? (
                    <Text style={[styles.delta, delta >= 0 ? styles.deltaUp : styles.deltaDown]}>
                      {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('analytics.trendTitle')}</Text>
            <View style={styles.trendRow}>
              {dailyTrend.slice(-14).map((row, idx) => {
                const total = pickNum(row, ['TotalScheduled', 'totalScheduled']);
                const h = Math.max(8, Math.round((total / maxTrend) * 80));
                return (
                  <View key={idx} style={styles.trendBarWrap}>
                    <View style={[styles.trendBar, { height: h }]} />
                  </View>
                );
              })}
            </View>
          </View>

          <Pressable style={styles.panel} onPress={() => router.push('/(app)/analytics-heatmap' as never)}>
            <Text style={styles.panelTitle}>{t('analytics.heatmapTitle')}</Text>
            <Text style={styles.link}>{t('analytics.viewFullHeatmap')}</Text>
          </Pressable>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('analytics.funnelTitle')}</Text>
            <Text style={styles.muted}>{t('analytics.allTime')}</Text>
            {[
              ['total', pickNum(retention, ['TotalUniquePatients', 'totalUniquePatients'])],
              ['once', pickNum(retention, ['SingleVisitPatients', 'singleVisitPatients'])],
              ['returning', pickNum(retention, ['ReturningPatients', 'returningPatients'])],
              ['loyal', pickNum(retention, ['LoyalPatients', 'loyalPatients'])]
            ].map(([key, count]) => (
              <View key={String(key)} style={styles.funnelRow}>
                <View style={[styles.funnelBar, { width: `${Math.max(12, Number(count) > 0 ? 40 : 8)}%` }]} />
                <Text style={styles.funnelLabel}>
                  {t(`analytics.funnel.${key}`)}: {count}
                </Text>
              </View>
            ))}
          </View>

          {role === 'ADMIN' && doctors.length > 1 ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t('analytics.doctorComparison')}</Text>
              {doctors.slice(0, 5).map((row, idx) => (
                <Pressable
                  key={idx}
                  style={styles.doctorRow}
                  onPress={() =>
                    setDoctorFilter({
                      id: pickStr(row, ['DoctorId', 'doctorId']),
                      name: pickStr(row, ['DoctorName', 'doctorName'])
                    })
                  }
                >
                  <Text style={styles.doctorName}>{pickStr(row, ['DoctorName', 'doctorName'])}</Text>
                  <Text style={styles.muted}>
                    {pickNum(row, ['TotalAppointments', 'totalAppointments'])} · {pickNum(row, ['CompletionRatePct', 'completionRatePct'])}%
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: TAB_SCROLL_BOTTOM_PADDING },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  exportBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  exportText: { fontSize: 12, color: colors.primaryDark },
  filterPill: { marginBottom: 8, color: colors.primaryDark, fontSize: 13 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '600' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  delta: { fontSize: 11, marginTop: 6 },
  deltaUp: { color: '#16a34a' },
  deltaDown: { color: '#dc2626' },
  panel: {
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  panelTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text },
  muted: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 90 },
  trendBarWrap: { flex: 1, justifyContent: 'flex-end' },
  trendBar: { backgroundColor: '#14b8a6', borderRadius: 4 },
  link: { color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  funnelBar: { height: 10, backgroundColor: '#0f766e', borderRadius: 4 },
  funnelLabel: { fontSize: 12, color: colors.text },
  doctorRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  doctorName: { fontSize: 14, fontWeight: '600', color: colors.text }
});

export default AnalyticsScreen;
