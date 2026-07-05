import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';
import { defaultAnalyticsRange, fetchAnalyticsOverviewMobile } from '@/features/analytics/analyticsApi';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/theme/colors';
import { TAB_SCROLL_BOTTOM_PADDING } from '@/theme/layout';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

export default function AnalyticsHeatmapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();
  const userId = String(useSessionStore((s) => s.user?.id ?? '')).trim();
  const range = defaultAnalyticsRange();

  const query = useQuery({
    queryKey: ['analytics-heatmap', range.from, range.to, userId],
    queryFn: async () => {
      const overview = await fetchAnalyticsOverviewMobile({
        from: range.from,
        to: range.to,
        doctorId: role === 'DOCTOR' ? userId : undefined
      });
      const raw = overview.Heatmap ?? overview.heatmap;
      return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    },
    staleTime: 3600000
  });

  const cells = query.data ?? [];
  const max = useMemo(
    () => cells.reduce((m, c) => Math.max(m, pickNum(c, ['TotalBooked', 'totalBooked'])), 0),
    [cells]
  );

  function color(booked: number): string {
    if (booked <= 0 || max <= 0) return '#f8fafc';
    const ratio = booked / max;
    if (ratio < 0.25) return '#ccfbf1';
    if (ratio < 0.5) return '#5eead4';
    if (ratio < 0.75) return '#14b8a6';
    return '#0f766e';
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('analytics.heatmapTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.headerRow}>
            <View style={styles.hourSpacer} />
            {DAY_LABELS.map((label) => (
              <Text key={label} style={styles.dayLabel}>
                {label}
              </Text>
            ))}
          </View>
          {Array.from({ length: 15 }, (_, i) => i + 7).map((hour) => (
            <View key={hour} style={styles.row}>
              <Text style={styles.hourLabel}>{hour}</Text>
              {DAY_LABELS.map((_, dow) => {
                const cell = cells.find(
                  (c) => pickNum(c, ['DayOfWeek', 'dayOfWeek']) === dow && pickNum(c, ['HourSlot', 'hourSlot']) === hour
                );
                const booked = cell ? pickNum(cell, ['TotalBooked', 'totalBooked']) : 0;
                const noShow = cell ? pickNum(cell, ['NoShowRatePct', 'noShowRatePct']) : 0;
                return (
                  <View
                    key={`${dow}-${hour}`}
                    style={[styles.cell, { backgroundColor: color(booked) }]}
                  >
                    {noShow > 25 ? <View style={styles.dot} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: TAB_SCROLL_BOTTOM_PADDING },
  back: { color: colors.primaryDark, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: colors.text },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  hourSpacer: { width: 28 },
  dayLabel: { width: 36, textAlign: 'center', fontSize: 10, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  hourLabel: { width: 28, fontSize: 10, color: colors.textMuted, textAlign: 'right', paddingRight: 4 },
  cell: { width: 36, height: 36, marginRight: 2, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  dot: { position: 'absolute', right: 2, bottom: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }
});
