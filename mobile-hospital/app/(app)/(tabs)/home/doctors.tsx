import { Redirect } from 'expo-router';

import { useSessionStore } from '@/auth/sessionStore';
import { DoctorsListScreen } from '@/features/doctors/DoctorsListScreen';

export default function DoctorsListRoute() {
  const accessToken = useSessionStore((s) => s.accessToken);

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return <DoctorsListScreen />;
}
