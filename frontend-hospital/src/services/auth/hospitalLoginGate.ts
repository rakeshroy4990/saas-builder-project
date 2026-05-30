import { nextTick } from 'vue';
import { useAppStore } from '../../store/useAppStore';
import { usePopupStore } from '../../store/usePopupStore';
import { pinia } from '../../store/pinia';

/**
 * Full-page routes that require a signed-in session (httpOnly cookie + profile).
 * Pop-up pageIds are included so deep links cannot bypass the shell.
 */
export const HOSPITAL_PROTECTED_PAGE_IDS = new Set([
  'dashboard',
  'prescriptions',
  'patient-dashboard',
  'profile',
  'doctor-working-slots',
  'doctor-education',
  'book-appointment',
  'chat',
  'appointment-receipts-popup',
  'video-call-popup',
  'chat-popup'
]);

export const HOSPITAL_DOCTOR_OR_ADMIN_PAGE_IDS = new Set(['doctor-working-slots']);

export const HOSPITAL_PATIENT_OR_ADMIN_PAGE_IDS = new Set(['patient-dashboard']);

export function hospitalSessionUserId(): string {
  const raw = useAppStore(pinia).getData('hospital', 'AuthSession') as Record<string, unknown> | undefined;
  return String(raw?.userId ?? '').trim();
}

export function hospitalSessionRole(): string {
  const raw = useAppStore(pinia).getData('hospital', 'AuthSession') as Record<string, unknown> | undefined;
  return String(raw?.role ?? '')
    .trim()
    .toUpperCase();
}

export function hospitalPageRequiresAuth(pageId: string): boolean {
  const id = String(pageId ?? '').trim();
  return id.length > 0 && HOSPITAL_PROTECTED_PAGE_IDS.has(id);
}

export function hospitalPageRoleAllowed(pageId: string): boolean {
  const role = hospitalSessionRole();
  if (HOSPITAL_DOCTOR_OR_ADMIN_PAGE_IDS.has(pageId)) {
    return role === 'DOCTOR' || role === 'ADMIN';
  }
  if (HOSPITAL_PATIENT_OR_ADMIN_PAGE_IDS.has(pageId)) {
    return role === 'PATIENT' || role === 'ADMIN';
  }
  return true;
}

/**
 * Opens the login popup and returns false when there is no signed-in user.
 * Uses nextTick so Teleport/backdrop paint in the same interaction as the click.
 */
export function openHospitalLoginPopup(infoMessage?: string): void {
  const appStore = useAppStore(pinia);
  if (infoMessage) {
    appStore.setProperty('hospital', 'AuthForm', 'loginInfoMessage', infoMessage);
  }
  usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'Login' });
  void nextTick();
}

export function ensureHospitalSessionOrOpenLogin(infoMessage?: string): boolean {
  if (hospitalSessionUserId()) return true;
  openHospitalLoginPopup(infoMessage);
  return false;
}
