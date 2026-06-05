import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import { LoadingView } from '@/components/LoadingView';
import { fetchAppointmentsPage } from '@/features/appointments/api';
import type { AppointmentSummary } from '@/features/appointments/types';
import { sharedStyles } from '@/theme/styles';

export default function AppointmentsTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await fetchAppointmentsPage(0, 20);
      setItems(list);
    } catch {
      setError(t('dashboard.loadError'));
    }
  }, [t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  return (
    <AuthGate>
      {loading ? (
        <LoadingView />
      ) : (
        <View style={sharedStyles.screenPadded}>
          <Pressable
            style={[sharedStyles.button, { marginBottom: 16 }]}
            onPress={() => router.push('/(app)/appointments/book' as never)}
          >
            <Text style={sharedStyles.buttonText}>{t('appointment.book.cta')}</Text>
          </Pressable>
          {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void (async () => {
                    setRefreshing(true);
                    await load();
                    setRefreshing(false);
                  })();
                }}
              />
            }
            ListEmptyComponent={<Text style={sharedStyles.subtitle}>{t('dashboard.emptyAppointments')}</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={sharedStyles.card}
                onPress={() => router.push(`/(app)/appointments/${item.id}`)}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>{item.patientName}</Text>
                <Text style={sharedStyles.subtitle}>
                  {item.preferredDate} · {item.preferredTimeSlot || '—'}
                </Text>
                <Text style={sharedStyles.subtitle}>
                  {item.doctorName} · {item.status}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </AuthGate>
  );
}
