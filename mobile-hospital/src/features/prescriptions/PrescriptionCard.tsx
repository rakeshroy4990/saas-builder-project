import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

import { buildPrescriptionCardFields, prescriptionStatusLabel } from './prescriptionDisplay';
import { PrescriptionSafetyNote } from './PrescriptionSafetyNote';
import type { PrescriptionItem } from './types';

type Props = {
  item: PrescriptionItem;
};

function statusColors(status: PrescriptionItem['status']): { bg: string; text: string } {
  switch (status) {
    case 'verified':
      return { bg: '#dcfce7', text: '#166534' };
    case 'processing':
      return { bg: '#e0f2fe', text: '#075985' };
    case 'rejected':
      return { bg: '#fee2e2', text: '#991b1b' };
    default:
      return { bg: '#f1f5f9', text: '#475569' };
  }
}

export function PrescriptionCard({ item }: Props) {
  const { t } = useTranslation();
  const fields = buildPrescriptionCardFields(item, t('prescriptions.notAvailable'));
  const badge = statusColors(fields.status);

  return (
    <View style={sharedStyles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {fields.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>
            {prescriptionStatusLabel(fields.status, t)}
          </Text>
        </View>
      </View>

      <Text style={styles.metaLine}>
        <Text style={styles.metaLabel}>{t('prescriptions.fields.doctor')}: </Text>
        {fields.doctorName}
      </Text>
      <Text style={styles.metaLine}>
        <Text style={styles.metaLabel}>{t('prescriptions.fields.patient')}: </Text>
        {fields.patientName}
      </Text>
      <Text style={styles.metaLine}>
        <Text style={styles.metaLabel}>{t('prescriptions.fields.date')}: </Text>
        {fields.dateLabel}
      </Text>
      <Text style={styles.medicines} numberOfLines={3}>
        <Text style={styles.metaLabel}>{t('prescriptions.fields.medicines')}: </Text>
        {fields.medicinesLine}
      </Text>

      {item.status === 'verified' ? <PrescriptionSafetyNote prescriptionId={item.id} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize'
  },
  metaLine: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4
  },
  metaLabel: {
    fontWeight: '600',
    color: colors.textMuted
  },
  medicines: {
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
    lineHeight: 20
  }
});
