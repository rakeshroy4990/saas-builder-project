import { Redirect } from 'expo-router';

import { useSessionStore } from '@/auth/sessionStore';
import { BookAppointmentScreen } from '@/features/appointments/BookAppointmentScreen';

export default function BookAppointmentRoute() {
  const accessToken = useSessionStore((s) => s.accessToken);

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return <BookAppointmentScreen />;
}
