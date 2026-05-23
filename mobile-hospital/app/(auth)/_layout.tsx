import { Stack } from 'expo-router';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';

export default function AuthLayout() {
  return (
    <AppErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
      </Stack>
    </AppErrorBoundary>
  );
}
