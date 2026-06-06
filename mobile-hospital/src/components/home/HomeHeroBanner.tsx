import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type HomeHeroBannerProps = {
  onCta: () => void;
  ctaLabel: string;
};

export function HomeHeroBanner({ onCta, ctaLabel }: HomeHeroBannerProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, styles.circleLarge]} />
      <View style={[styles.circle, styles.circleSmall]} />

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('home.launcher.heroBadge')}</Text>
      </View>

      <Text style={styles.title}>{t('home.launcher.heroTitle')}</Text>
      <Text style={styles.subtitle}>{t('home.launcher.heroSubtitle')}</Text>

      <Pressable style={styles.cta} onPress={onCta} accessibilityRole="button">
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 20,
    overflow: 'hidden'
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  circleLarge: {
    width: 140,
    height: 140,
    top: -36,
    right: -24
  },
  circleSmall: {
    width: 72,
    height: 72,
    bottom: 12,
    left: -18
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 28,
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 20,
    marginBottom: 16
  },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  }
});
