import { Stack } from 'expo-router';

import { AuthGate } from '@/components/AuthGate';
import { TriageScreen } from '@/features/triage/TriageScreen';
import { useLocalSearchParams } from 'expo-router';

export default function TriageRoute() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId?: string }>();

  return (
    <AuthGate>
      <Stack.Screen options={{ title: 'Check symptoms' }} />
      <TriageScreen appointmentId={appointmentId ? String(appointmentId) : undefined} />
    </AuthGate>
  );
}
