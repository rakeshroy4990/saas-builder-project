import { usePopupStore } from '../../../../store/usePopupStore';
import { pinia } from '../../../../store/pinia';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Opens the mandatory language onboarding popup when the user is signed in but has no `preferredLocale` in session.
 * Safe to call on startup (covers refresh) and after login (`execute-post-login-action`).
 */
export function maybeOpenLocaleOnboardingIfNeeded(): void {
  const appStore = useAppStore(pinia);
  const session = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const uid = String(session.userId ?? '').trim();
  const pl = String(session.preferredLocale ?? '').trim();
  if (!uid || pl.length > 0) {
    return;
  }
  usePopupStore(pinia).open({
    packageName: 'hospital',
    pageId: 'locale-onboarding-popup',
    initKey: `locale-onboarding-${Date.now()}`
  });
}
