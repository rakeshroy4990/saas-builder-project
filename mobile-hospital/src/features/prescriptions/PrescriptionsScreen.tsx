import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LoadingView } from '@/components/LoadingView';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

import { PrescriptionCard } from './PrescriptionCard';
import { PrescriptionUploadPanel } from './PrescriptionUploadPanel';
import { fetchPrescriptionsPage } from './prescriptionsApi';
import type { PrescriptionItem, PrescriptionTab } from './types';

const MENU_LABEL_LINE_HEIGHT = 18;
const MENU_LABEL_LINES = 2;
const MENU_LABEL_BLOCK_HEIGHT = MENU_LABEL_LINE_HEIGHT * MENU_LABEL_LINES;

type PrescriptionNavButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function PrescriptionNavButton({ label, active, onPress }: PrescriptionNavButtonProps) {
  return (
    <Pressable
      style={[styles.menuBtn, active && styles.menuBtnActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.menuBtnLabelSlot}>
        <Text
          style={[styles.menuText, active && styles.menuTextActive]}
          numberOfLines={MENU_LABEL_LINES}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function PrescriptionsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PrescriptionTab>('view');
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTab('view');
    }, [])
  );

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
        <PrescriptionNavButton
          label={t('prescriptions.nav.view')}
          active={tab === 'view'}
          onPress={() => setTab('view')}
        />
        <PrescriptionNavButton
          label={t('prescriptions.nav.upload')}
          active={tab === 'upload'}
          onPress={() => setTab('upload')}
        />
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
    alignItems: 'stretch',
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuBtnActive: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5'
  },
  menuBtnLabelSlot: {
    height: MENU_LABEL_BLOCK_HEIGHT,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: MENU_LABEL_LINE_HEIGHT,
    fontWeight: '600',
    color: colors.text,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const }
      : null)
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
