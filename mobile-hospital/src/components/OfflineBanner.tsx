import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkStore } from '@/network/networkStore';
import { colors } from '@/theme/colors';

/**
 * Top banner when the device is offline — avoids silent API failures.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const isOffline = useNetworkStore((s) => s.isOffline);
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: Math.max(insets.top, 8) }]} accessibilityRole="alert">
      <Text style={styles.text}>{t('network.offlineBanner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10_000
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  }
});
