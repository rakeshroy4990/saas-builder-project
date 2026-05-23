import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionNavigationTelemetry } from '@/analytics/navigationTelemetry';
import { SessionTelemetrySync } from '@/analytics/SessionTelemetrySync';
import { AuthProvider } from '@/auth/AuthProvider';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import '@/i18n';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useEffect(() => {
    // Splash is hidden from AuthProvider once session restore finishes.
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <SessionNavigationTelemetry />
          <SessionTelemetrySync />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
