import { Redirect, Stack } from 'expo-router';

import { useSessionStore } from '@/auth/sessionStore';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { LoadingView } from '@/components/LoadingView';
import { ChatFab } from '@/components/ChatFab';
import { VideoCallNavigator } from '@/features/video/VideoCallNavigator';

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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="ai-chat"
          options={{ title: 'Chat', headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="appointments/book"
          options={{ title: 'Book appointment', headerShown: true }}
        />
        <Stack.Screen name="appointments/[id]" options={{ title: 'Appointment', headerShown: true }} />
        <Stack.Screen
          name="video-call"
          options={{ title: 'Video call', headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>
    </AppErrorBoundary>
  );
}
