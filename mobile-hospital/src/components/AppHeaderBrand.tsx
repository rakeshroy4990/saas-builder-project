import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HOSPITAL_LOGO_URL } from '@/config/brand';
import { openMainTab } from '@/navigation/openTab';
import { colors } from '@/theme/colors';

/** Compact logo + title for stack/tab headers; tap returns to the Home tab. */
export function AppHeaderBrand() {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => openMainTab('home')}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={t('hospital.goHome')}
    >
      <Image
        source={{ uri: HOSPITAL_LOGO_URL }}
        style={styles.logo}
        accessibilityLabel={t('hospital.logoAlt')}
      />
      <Text style={styles.title} numberOfLines={1}>
        {t('hospital.brandTitle')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 220
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: colors.surface
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text
  }
});
