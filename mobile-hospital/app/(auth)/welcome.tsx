import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HOSPITAL_LOGO_URL } from '@/config/brand';
import { colors } from '@/theme/colors';

const DISPLAY_MS = 1200;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(12)).current;

  const goToLogin = useCallback(() => {
    router.replace('/(auth)/login' as never);
  }, [router]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 40, useNativeDriver: true })
    ]).start();

    const textTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(textTranslate, { toValue: 0, duration: 400, useNativeDriver: true })
      ]).start();
    }, 200);

    const navTimer = setTimeout(() => {
      goToLogin();
    }, DISPLAY_MS);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(navTimer);
    };
  }, [goToLogin, logoOpacity, logoScale, textOpacity, textTranslate]);

  return (
    <Pressable
      style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      onPress={goToLogin}
      accessibilityRole="button"
      accessibilityLabel={t('welcome.skip')}
    >
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Image source={{ uri: HOSPITAL_LOGO_URL }} style={styles.logo} accessibilityLabel={t('hospital.logoAlt')} />
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslate }] }}>
        <Text style={styles.title}>{t('hospital.brandTitle')}</Text>
        <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
      </Animated.View>
      <Text style={styles.skipHint}>{t('welcome.tapToContinue')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 28,
    backgroundColor: colors.surface
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center'
  },
  tagline: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24
  },
  skipHint: {
    position: 'absolute',
    bottom: 32,
    fontSize: 14,
    color: colors.textMuted
  }
});
