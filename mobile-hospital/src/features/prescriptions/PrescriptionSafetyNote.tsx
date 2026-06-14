import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

import { fetchPrescriptionValidation, type PrescriptionValidation } from './prescriptionValidationApi';

type Props = {
  prescriptionId: string;
};

export function PrescriptionSafetyNote({ prescriptionId }: Props) {
  const { t } = useTranslation();
  const [validation, setValidation] = useState<PrescriptionValidation | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPrescriptionValidation(prescriptionId)
      .then((result) => {
        if (!cancelled) setValidation(result);
      })
      .catch(() => {
        if (!cancelled) setValidation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [prescriptionId]);

  if (!validation) return null;
  const level = validation.overallRiskLevel;
  if (level === 'none' || level === 'low') return null;

  const isCritical = level === 'critical';

  return (
    <View style={[styles.card, isCritical ? styles.cardCritical : styles.cardInfo]}>
      <Text style={[styles.text, isCritical ? styles.textCritical : styles.textInfo]}>
        {isCritical ? t('prescriptionSafety.patientCritical') : t('prescriptionSafety.patientRoutine')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    marginTop: 10
  },
  cardInfo: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd'
  },
  cardCritical: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  text: {
    fontSize: 14,
    lineHeight: 20
  },
  textInfo: {
    color: '#0c4a6e'
  },
  textCritical: {
    color: colors.text,
    fontWeight: '600'
  }
});
