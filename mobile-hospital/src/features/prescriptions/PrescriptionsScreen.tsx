import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LoadingView } from '@/components/LoadingView';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

import { PrescriptionCard } from './PrescriptionCard';
import { PrescriptionUploadPanel } from './PrescriptionUploadPanel';
import { fetchPrescriptionsPage } from './prescriptionsApi';
import type { PrescriptionItem, PrescriptionTab } from './types';

export function PrescriptionsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PrescriptionTab>('view');
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await fetchPrescriptionsPage(0, 50);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return <LoadingView />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.menu}>
        <Pressable
          style={[styles.menuBtn, tab === 'view' && styles.menuBtnActive]}
          onPress={() => setTab('view')}
        >
          <Text style={[styles.menuText, tab === 'view' && styles.menuTextActive]}>
            {t('prescriptions.nav.view')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.menuBtn, tab === 'upload' && styles.menuBtnActive]}
          onPress={() => setTab('upload')}
        >
          <Text style={[styles.menuText, tab === 'upload' && styles.menuTextActive]}>
            {t('prescriptions.nav.upload')}
          </Text>
        </Pressable>
      </View>

      {tab === 'upload' ? (
        <View style={styles.panel}>
          <PrescriptionUploadPanel
            onUploaded={() => {
              void load();
              setTab('view');
            }}
          />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          ListHeaderComponent={
            error ? <Text style={sharedStyles.errorText}>{error}</Text> : null
          }
          ListEmptyComponent={
            !error ? <Text style={sharedStyles.subtitle}>{t('prescriptions.empty')}</Text> : null
          }
          renderItem={({ item }) => <PrescriptionCard item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  menu: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  menuBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  menuBtnActive: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5'
  },
  menuText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  menuTextActive: {
    color: colors.primaryDark
  },
  panel: {
    flex: 1,
    paddingHorizontal: 16
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 96
  }
});
