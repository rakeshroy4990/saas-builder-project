import { StyleSheet } from 'react-native';

import { colors } from '@/theme/colors';

/** Reusable growth workspace chrome — mirrors web `hosp.workspace.*` tokens. */
export const growthStyles = StyleSheet.create({
  rootGap: {
    gap: 16
  },
  panel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  panelMuted: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#f8fafc',
    padding: 14
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18
  },
  collapsibleTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  collapsibleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    paddingRight: 8
  },
  collapsibleChevron: {
    fontSize: 12,
    color: colors.textMuted
  },
  collapsibleBody: {
    marginTop: 10,
    gap: 8
  },
  guideItem: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  guideItemActive: {
    backgroundColor: '#ecfdf5'
  },
  guideItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text
  },
  guideItemText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginTop: 2
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  metricPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999
  },
  metricPillActive: {
    backgroundColor: colors.primary
  },
  metricPillInactive: {
    backgroundColor: '#f1f5f9'
  },
  metricPillTextActive: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },
  metricPillTextInactive: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600'
  },
  childCard: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  childCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#ecfdf5'
  },
  childCardDefault: {
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  childName: {
    fontWeight: '600',
    color: colors.text
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  historyValues: {
    fontSize: 13,
    color: '#475569'
  },
  percentileHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  percentileBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4
  },
  percentileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  percentileBadgeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569'
  },
  percentileBadgeValue: {
    fontSize: 12,
    fontWeight: '700'
  },
  callout: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 12,
    gap: 8
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text
  },
  calloutLine: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18
  },
  calloutStrong: {
    fontWeight: '600',
    color: '#334155'
  },
  guidePanel: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#f8fafc',
    padding: 12,
    gap: 8
  },
  guidePanelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  guidePanelText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  recordingCadence: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderLeftWidth: 4,
    borderLeftColor: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  recordingCadenceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#064e3b'
  },
  recordingCadenceBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#022c22'
  }
});
