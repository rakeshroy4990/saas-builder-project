import { Redirect } from 'expo-router';

import { useSessionStore } from '@/auth/sessionStore';
import { LoadingView } from '@/components/LoadingView';

export default function Index() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const hydrated = useSessionStore((s) => s.hydrated);

  if (!hydrated) {
    return <LoadingView />;
  }

  if (accessToken) {
    return <Redirect href={'/(app)/(tabs)/home' as never} />;
  }

  return <Redirect href="/(auth)/login" />;
}
