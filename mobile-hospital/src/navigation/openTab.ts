import { router } from 'expo-router';

/** Switch bottom tabs reliably (use instead of full-path push from home cards). */
export type MainTab = 'home' | 'appointments' | 'prescriptions' | 'blog' | 'ai-diagnosis' | 'profile';

export function openMainTab(tab: MainTab): void {
  router.navigate(`/(app)/(tabs)/${tab}` as never);
}
