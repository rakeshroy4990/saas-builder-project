import { Stack } from 'expo-router';

import { AuthGate } from '@/components/AuthGate';
import { DeviceReadScreen } from '@/features/devices/DeviceReadScreen';

export default function DeviceReadRoute() {
  return (
    <AuthGate>
      <Stack.Screen options={{ title: 'Bluetooth scale' }} />
      <DeviceReadScreen />
    </AuthGate>
  );
}
