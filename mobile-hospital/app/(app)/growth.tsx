import { Stack } from 'expo-router';

import { AuthGate } from '@/components/AuthGate';
import { GrowthScreen } from '@/features/growth/GrowthScreen';

export default function GrowthRoute() {
  return (
    <AuthGate>
      <Stack.Screen options={{ title: 'Growth' }} />
      <GrowthScreen />
    </AuthGate>
  );
}
