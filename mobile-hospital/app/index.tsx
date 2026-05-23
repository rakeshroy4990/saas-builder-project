import { Redirect } from 'expo-router';

import { useSessionStore } from '@/auth/sessionStore';

export default function Index() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const guestMode = useSessionStore((s) => s.guestMode);

  if (accessToken || guestMode) {
    return <Redirect href={'/(app)/(tabs)/home' as never} />;
  }

  return <Redirect href={'/(auth)/login' as never} />;
}
