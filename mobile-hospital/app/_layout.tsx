import 'react-native-gesture-handler';

import {
  NotoSansDevanagari_400Regular
} from '@expo-google-fonts/noto-sans-devanagari';
import {
  NotoSansKannada_400Regular
} from '@expo-google-fonts/noto-sans-kannada';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionNavigationTelemetry } from '@/analytics/navigationTelemetry';
import { SessionTelemetrySync } from '@/analytics/SessionTelemetrySync';
import { initCertificatePinningIfConfigured } from '@/api/certificatePinning';
import { registerGlobalCrashTelemetry } from '@/analytics/crashTelemetry';
import { QueryProvider } from '@/api/QueryProvider';
import { SessionTokenKeeper } from '@/api/sessionTokenKeeper';
import { AuthProvider } from '@/auth/AuthProvider';
import { BiometricAppLockOverlay } from '@/auth/BiometricAppLock';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useNetworkSync } from '@/network/useNetworkSync';
import '@/i18n';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useNetworkSync();
  const [fontsLoaded] = useFonts({
    NotoSansKannada_400Regular,
    NotoSansDevanagari_400Regular
  });

  useEffect(() => {
    void initCertificatePinningIfConfigured();
    registerGlobalCrashTelemetry();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider style={styles.safeArea}>
        <View style={styles.appRoot}>
          <OfflineBanner />
          <AuthProvider>
            <QueryProvider>
              <SessionTokenKeeper />
              <SessionNavigationTelemetry />
              <SessionTelemetrySync />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
            </QueryProvider>
          </AuthProvider>
          <BiometricAppLockOverlay />
        </View>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  appRoot: {
    flex: 1
  }
});
