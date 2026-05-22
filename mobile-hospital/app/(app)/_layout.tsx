import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '@/auth/sessionStore';
import { LoadingView } from '@/components/LoadingView';

export default function AppLayout() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const hydrated = useSessionStore((s) => s.hydrated);

  if (!hydrated) {
    return <LoadingView />;
  }

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="appointments/[id]" options={{ title: 'Appointment', headerShown: true }} />
    </Stack>
  );
}
