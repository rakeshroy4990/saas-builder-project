import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { HOSPITAL_LOGO_URL } from '@/config/brand';
import { colors } from '@/theme/colors';

type BrandHeaderProps = {
  subtitle?: string;
  centered?: boolean;
};

export function BrandHeader({ subtitle, centered = true }: BrandHeaderProps) {
  const { t } = useTranslation();

  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      <Image
        source={{ uri: HOSPITAL_LOGO_URL }}
        style={styles.logo}
        accessibilityLabel={t('hospital.logoAlt')}
      />
      <Text style={styles.title}>{t('hospital.brandTitle')}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24
  },
  centered: {
    alignItems: 'center'
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 12,
    backgroundColor: colors.surface
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center'
  }
});
