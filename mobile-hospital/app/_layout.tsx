import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionNavigationTelemetry } from '@/analytics/navigationTelemetry';
import { SessionTelemetrySync } from '@/analytics/SessionTelemetrySync';
import { initCertificatePinningIfConfigured } from '@/api/certificatePinning';
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

  useEffect(() => {
    void initCertificatePinningIfConfigured();
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider style={styles.safeArea}>
        <View style={styles.appRoot}>
          <OfflineBanner />
          <AuthProvider>
            <SessionTokenKeeper />
            <SessionNavigationTelemetry />
            <SessionTelemetrySync />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
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
