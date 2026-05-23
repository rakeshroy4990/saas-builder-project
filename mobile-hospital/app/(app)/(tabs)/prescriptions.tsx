import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import { LoadingView } from '@/components/LoadingView';
import { fetchPrescriptionsPage, type PrescriptionItem } from '@/features/prescriptions/prescriptionsApi';
import { sharedStyles } from '@/theme/styles';

export default function PrescriptionsTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await fetchPrescriptionsPage(0, 20);
      setItems(list);
    } catch {
      setError(t('prescriptions.loadError'));
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
            ListEmptyComponent={<Text style={sharedStyles.subtitle}>{t('prescriptions.empty')}</Text>}
            renderItem={({ item }) => (
              <View style={sharedStyles.card}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>{item.title}</Text>
                <Text style={sharedStyles.subtitle}>
                  {item.status} {item.createdAt ? `· ${item.createdAt}` : ''}
                </Text>
              </View>
            )}
          />
        </View>
      )}
    </AuthGate>
  );
}
