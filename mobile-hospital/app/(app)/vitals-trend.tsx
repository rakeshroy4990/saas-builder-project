import { Stack } from 'expo-router';

import { AuthGate } from '@/components/AuthGate';
import { VitalsTrendScreen } from '@/features/devices/VitalsTrendScreen';

export default function VitalsTrendRoute() {
  return (
    <AuthGate>
      <Stack.Screen options={{ title: 'Vitals trend' }} />
      <VitalsTrendScreen />
    </AuthGate>
  );
}
