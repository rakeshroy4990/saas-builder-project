import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { SECTION_GAP, SURFACE_RADIUS } from '@/theme/layout';

type HomeHeroBannerProps = {
  onCta: () => void;
  ctaLabel: string;
  onSecondaryCta?: () => void;
  secondaryCtaLabel?: string;
};

export function HomeHeroBanner({
  onCta,
  ctaLabel,
  onSecondaryCta,
  secondaryCtaLabel
}: HomeHeroBannerProps) {
  const { t } = useTranslation();
  const showSecondary = Boolean(onSecondaryCta && secondaryCtaLabel);

  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, styles.circleLarge]} />
      <View style={[styles.circle, styles.circleSmall]} />

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('home.launcher.heroBadge')}</Text>
      </View>

      <Text style={styles.title}>{t('home.launcher.heroTitle')}</Text>
      <Text style={styles.subtitle}>{t('home.launcher.heroSubtitle')}</Text>

      <View style={styles.ctaRow}>
        <Pressable style={styles.cta} onPress={onCta} accessibilityRole="button">
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
        {showSecondary ? (
          <Pressable style={styles.ctaSecondary} onPress={onSecondaryCta} accessibilityRole="button">
            <Text style={styles.ctaSecondaryText}>{secondaryCtaLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: SURFACE_RADIUS + 4,
    marginBottom: SECTION_GAP,
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
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
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
  },
  ctaSecondary: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  ctaSecondaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700'
  }
});
