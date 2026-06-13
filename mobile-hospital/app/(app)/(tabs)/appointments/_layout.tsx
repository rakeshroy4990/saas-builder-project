import { Stack } from 'expo-router';

import { appHeaderScreenOptions } from '@/navigation/appHeader';

export default function AppointmentsLayout() {
  return (
    <Stack screenOptions={appHeaderScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="book" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
