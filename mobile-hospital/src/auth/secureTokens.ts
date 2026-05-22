import * as SecureStore from 'expo-secure-store';

import type { SessionUser } from './sessionStore';

const REFRESH_KEY = 'agastya.refresh.v1';
const PROFILE_KEY = 'agastya.profile.v1';

export async function getStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

export async function setStoredRefreshToken(token: string | null): Promise<void> {
  try {
    if (!token) {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  } catch {
    // SecureStore unavailable on web simulator — ignore
  }
}

export async function getStoredSessionProfile(): Promise<SessionUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function setStoredSessionProfile(user: SessionUser | null): Promise<void> {
  try {
    if (!user) {
      await SecureStore.deleteItemAsync(PROFILE_KEY);
      return;
    }
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export async function clearSecureAuth(): Promise<void> {
  await setStoredRefreshToken(null);
  await setStoredSessionProfile(null);
}
