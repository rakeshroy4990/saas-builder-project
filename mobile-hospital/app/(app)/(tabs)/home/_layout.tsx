import { Stack } from 'expo-router';

import { appHeaderScreenOptions } from '@/navigation/appHeader';

export default function HomeLayout() {
  return (
    <Stack screenOptions={appHeaderScreenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="doctors" />
    </Stack>
  );
}
