import { isSupportedLocale, type LocaleCode } from '@saas-builder/i18n-contract';
import { pickString, SERVER_PATHS, unwrapEnvelope } from '@saas-builder/hospital-api-client';

import { apiClient } from '@/api/client';
import { setStoredSessionProfile } from '@/auth/secureTokens';
import { useSessionStore, type SessionUser } from '@/auth/sessionStore';
import { activeMobileLocale, setMobileLocale } from '@/i18n/locale';

export function pickPreferredLocale(row: Record<string, unknown>): LocaleCode | null {
  const raw = pickString(row, ['PreferredLocale', 'preferredLocale']).trim().toLowerCase();
  return isSupportedLocale(raw) ? raw : null;
}

export async function savePreferredLocaleToServer(userId: string, locale: LocaleCode): Promise<void> {
  await apiClient.put(
    SERVER_PATHS.userProfile,
    { PreferredLocale: locale },
    { params: { userId: userId.trim() } }
  );
}

function patchSessionPreferredLocale(locale: LocaleCode): void {
  const user = useSessionStore.getState().user;
  if (!user) return;
  const next: SessionUser = { ...user, preferredLocale: locale };
  useSessionStore.setState({ user: next });
  void setStoredSessionProfile(next);
}

/** Update UI locale locally and sync to the user profile when signed in. */
export async function changeAppLocale(next: LocaleCode, userId?: string): Promise<void> {
  await setMobileLocale(next);
  const uid = userId?.trim();
  if (!uid) return;
  patchSessionPreferredLocale(next);
  try {
    await savePreferredLocaleToServer(uid, next);
  } catch {
    // Non-fatal: local preference is kept; profile can be synced on next change.
  }
}

/** After login: honor server `PreferredLocale`, otherwise keep current UI locale and backfill profile. */
export async function finalizeMobileLoginLocale(
  userData: Record<string, unknown>,
  userId: string
): Promise<void> {
  const fromApi = pickPreferredLocale(userData);
  const resolved = fromApi ?? activeMobileLocale();
  await setMobileLocale(resolved);
  patchSessionPreferredLocale(resolved);
  if (!fromApi && userId.trim()) {
    try {
      await savePreferredLocaleToServer(userId.trim(), resolved);
    } catch {
      // Non-fatal: locale remains in client storage.
    }
  }
}

/** After session restore: align UI with profile `PreferredLocale` when present. */
export async function applyPreferredLocaleFromProfile(userId: string): Promise<void> {
  try {
    const response = await apiClient.get(SERVER_PATHS.user, { params: { userId: userId.trim() } });
    const data = unwrapEnvelope<unknown>(response.data);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const preferred = pickPreferredLocale(data as Record<string, unknown>);
    if (!preferred) return;
    await setMobileLocale(preferred);
    patchSessionPreferredLocale(preferred);
  } catch {
    // Non-fatal: keep locally persisted locale.
  }
}
