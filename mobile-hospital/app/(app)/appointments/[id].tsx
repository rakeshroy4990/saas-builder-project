import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { LoadingView } from '@/components/LoadingView';
import { fetchAppointmentById } from '@/features/appointments/api';
import type { AppointmentSummary } from '@/features/appointments/types';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

export default function AppointmentDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [appointment, setAppointment] = useState<AppointmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const row = await fetchAppointmentById(String(id));
        setAppointment(row);
        if (!row) setError(t('dashboard.loadError'));
      } catch {
        setError(t('dashboard.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  if (loading) {
    return <LoadingView />;
  }

  if (!appointment) {
    return (
      <View style={sharedStyles.screenPadded}>
        <Text style={sharedStyles.errorText}>{error || t('dashboard.loadError')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={sharedStyles.screenPadded}>
      <Text style={sharedStyles.title}>{t('appointment.detailTitle')}</Text>
      <View style={[sharedStyles.card, { marginTop: 16 }]}>
        <DetailRow label={t('appointment.patient')} value={appointment.patientName} />
        <DetailRow label={t('appointment.doctor')} value={appointment.doctorName} />
        <DetailRow label={t('appointment.date')} value={appointment.preferredDate} />
        <DetailRow label={t('appointment.time')} value={appointment.preferredTimeSlot} />
        <DetailRow label={t('appointment.status')} value={appointment.status} />
        <DetailRow label={t('appointment.department')} value={appointment.department} />
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={sharedStyles.label}>{label}</Text>
      <Text style={{ fontSize: 16, color: colors.text }}>{value || '—'}</Text>
    </View>
  );
}
