import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HOSPITAL_LOGO_URL } from '@/config/brand';
import { colors } from '@/theme/colors';

/** Compact logo + title for stack/tab headers. */
export function AppHeaderBrand() {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Image
        source={{ uri: HOSPITAL_LOGO_URL }}
        style={styles.logo}
        accessibilityLabel={t('hospital.logoAlt')}
      />
      <Text style={styles.title} numberOfLines={1}>
        {t('hospital.brandTitle')}
      </Text>
    </View>
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
