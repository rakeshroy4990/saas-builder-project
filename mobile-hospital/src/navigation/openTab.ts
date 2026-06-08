import { router } from 'expo-router';

/** Switch bottom tabs reliably (use instead of full-path push from home cards). */
export type MainTab = 'home' | 'appointments' | 'prescriptions' | 'blog' | 'ai-diagnosis' | 'profile';

export function openMainTab(tab: MainTab): void {
  const path = `/(app)/(tabs)/${tab}` as const;
  if (tab === 'home') {
    router.replace(path as never);
    return;
  }
  router.navigate(path as never);
}
