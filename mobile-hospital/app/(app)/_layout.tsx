import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '@/auth/sessionStore';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { LoadingView } from '@/components/LoadingView';
import { ChatFab } from '@/components/ChatFab';
import { VideoCallNavigator } from '@/features/video/VideoCallNavigator';
import { appHeaderScreenOptions } from '@/navigation/appHeader';

export default function AppLayout() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const guestMode = useSessionStore((s) => s.guestMode);
  const hydrated = useSessionStore((s) => s.hydrated);

  if (!hydrated) {
    return <LoadingView />;
  }

  if (!accessToken && !guestMode) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <AppErrorBoundary>
      <VideoCallNavigator />
      <ChatFab />
      <Stack screenOptions={appHeaderScreenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="ai-chat"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen name="appointments/book" options={{ headerShown: true }} />
        <Stack.Screen name="doctors/index" options={{ headerShown: true }} />
        <Stack.Screen name="appointments/[id]" options={{ headerShown: true }} />
        <Stack.Screen
          name="video-call"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>
    </AppErrorBoundary>
  );
}
