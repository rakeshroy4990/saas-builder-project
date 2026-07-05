import { Stack } from 'expo-router';

import { SmartWatchConnectScreen } from '@/features/devices/SmartWatchConnectScreen';

export default function SmartWatchConnectRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Smart watch' }} />
      <SmartWatchConnectScreen />
    </>
  );
}
