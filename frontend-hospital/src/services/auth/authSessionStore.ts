import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';

type PersistedAuthSession = {
  userId: string;
  userDisplayName: string;
  fullName: string;
  loginDisplayName: string;
  email: string;
  mobileNumber: string;
  address: string;
  gender: string;
  department: string;
  /** Server role, e.g. PATIENT, ADMIN, DOCTOR */
  role: string;
};

const AUTH_SESSION_KEY = 'flexshell_auth_session_profile';

const toStringSafe = (value: unknown): string => String(value ?? '').trim();

export function persistAuthSessionProfile(partial: Partial<PersistedAuthSession>): void {
  try {
    const existing = readPersistedAuthSession();
    const merged: PersistedAuthSession = {
      userId: toStringSafe(partial.userId ?? existing?.userId),
      userDisplayName: toStringSafe(partial.userDisplayName ?? existing?.userDisplayName),
      fullName: toStringSafe(partial.fullName ?? existing?.fullName),
      loginDisplayName: toStringSafe(partial.loginDisplayName ?? existing?.loginDisplayName) || 'Login',
      email: toStringSafe(partial.email ?? existing?.email),
      mobileNumber: toStringSafe(partial.mobileNumber ?? existing?.mobileNumber),
      address: toStringSafe(partial.address ?? existing?.address),
      gender: toStringSafe(partial.gender ?? existing?.gender),
      department: toStringSafe(partial.department ?? existing?.department),
      role: toStringSafe(partial.role ?? existing?.role)
    };
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(merged));
  } catch {
    // no-op
  }
}

export function clearPersistedAuthSessionProfile(): void {
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // no-op
  }
}

export function hydrateAuthSessionProfile(): void {
  const session = readPersistedAuthSession();
  if (!session) return;

  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AuthSession', 'userId', session.userId);
  appStore.setProperty('hospital', 'AuthSession', 'userDisplayName', session.userDisplayName);
  appStore.setProperty('hospital', 'AuthSession', 'fullName', session.fullName);
  appStore.setProperty('hospital', 'AuthSession', 'loginDisplayName', session.loginDisplayName || 'Login');
  appStore.setProperty('hospital', 'AuthSession', 'email', session.email);
  appStore.setProperty('hospital', 'AuthSession', 'mobileNumber', session.mobileNumber);
  appStore.setProperty('hospital', 'AuthSession', 'address', session.address);
  appStore.setProperty('hospital', 'AuthSession', 'gender', session.gender);
  appStore.setProperty('hospital', 'AuthSession', 'department', session.department);
  appStore.setProperty('hospital', 'AuthSession', 'role', session.role);
}

function readPersistedAuthSession(): PersistedAuthSession | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAuthSession>;
    if (!parsed.userId || toStringSafe(parsed.userId).length === 0) return null;
    return {
      userId: toStringSafe(parsed.userId),
      userDisplayName: toStringSafe(parsed.userDisplayName),
      fullName: toStringSafe(parsed.fullName),
      loginDisplayName: toStringSafe(parsed.loginDisplayName) || 'Login',
      email: toStringSafe(parsed.email),
      mobileNumber: toStringSafe(parsed.mobileNumber),
      address: toStringSafe(parsed.address),
      gender: toStringSafe(parsed.gender),
      department: toStringSafe(parsed.department),
      role: toStringSafe(parsed.role)
    };
  } catch {
    return null;
  }
}
