import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HOSPITAL_LOGO_URL } from '@/config/brand';
import { colors } from '@/theme/colors';

/** Cold-start intro length — matches session restore cap in AuthProvider. */
export const BRAND_INTRO_DURATION_MS = 2_500;

const LOGO_START_SCALE = 2.6;
const TITLE_DELAY_MS = 400;

export function BrandIntroSplash() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const logoScale = useSharedValue(LOGO_START_SCALE);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(12);

  useEffect(() => {
    logoScale.value = withTiming(1, {
      duration: BRAND_INTRO_DURATION_MS,
      easing: Easing.out(Easing.cubic)
    });
    logoOpacity.value = withTiming(1, {
      duration: BRAND_INTRO_DURATION_MS * 0.7,
      easing: Easing.out(Easing.quad)
    });
    titleOpacity.value = withDelay(
      TITLE_DELAY_MS,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
    titleTranslateY.value = withDelay(
      TITLE_DELAY_MS,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, [logoOpacity, logoScale, titleOpacity, titleTranslateY]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }]
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }]
  }));

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={t('auth.brandIntro')}
    >
      <View style={styles.center}>
        <Animated.View style={[styles.logoWrap, logoAnimatedStyle]}>
          <Image
            source={{ uri: HOSPITAL_LOGO_URL }}
            style={styles.logo}
            accessibilityLabel={t('hospital.logoAlt')}
          />
        </Animated.View>
        <Animated.View style={titleAnimatedStyle}>
          <Text style={styles.title}>{t('hospital.brandTitle')}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  title: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 0.2
  }
});
