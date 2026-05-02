import type { Router } from 'vue-router';
import { useAppStore } from '../store/useAppStore';
import { usePopupStore } from '../store/usePopupStore';
import { pinia } from '../store/pinia';

/**
 * Full-page routes that require a signed-in session (httpOnly cookie + profile).
 * Pop-up pageIds are included so deep links cannot bypass the shell.
 */
const REQUIRES_AUTHENTICATED_SESSION = new Set([
  'dashboard',
  'patient-dashboard',
  'profile',
  'doctor-working-slots',
  'chat',
  'appointment-receipts-popup',
  'video-call-popup',
  'chat-popup'
]);

const REQUIRES_DOCTOR_OR_ADMIN = new Set(['doctor-working-slots']);

const REQUIRES_PATIENT_OR_ADMIN = new Set(['patient-dashboard']);

function sessionUserId(): string {
  const raw = useAppStore(pinia).getData('hospital', 'AuthSession') as Record<string, unknown> | undefined;
  return String(raw?.userId ?? '').trim();
}

function sessionRole(): string {
  const raw = useAppStore(pinia).getData('hospital', 'AuthSession') as Record<string, unknown> | undefined;
  return String(raw?.role ?? '')
    .trim()
    .toUpperCase();
}

/**
 * Blocks unauthenticated navigation to sensitive hospital routes (direct URL / bookmark).
 */
export function registerHospitalRouteGuards(router: Router): void {
  router.beforeEach((to) => {
    if (to.meta?.public === true) return true;
    if (to.path.startsWith('/_')) return true;

    const pageId = String(to.params.pageId ?? '').trim();
    if (!pageId || !REQUIRES_AUTHENTICATED_SESSION.has(pageId)) {
      return true;
    }

    if (!sessionUserId()) {
      const popupStore = usePopupStore(pinia);
      popupStore.open({ packageName: 'hospital', pageId: 'login-popup', title: 'Login' });
      return { path: '/home', replace: true };
    }

    const role = sessionRole();
    if (REQUIRES_DOCTOR_OR_ADMIN.has(pageId)) {
      if (role !== 'DOCTOR' && role !== 'ADMIN') {
        return { path: '/home', replace: true };
      }
    }
    if (REQUIRES_PATIENT_OR_ADMIN.has(pageId)) {
      if (role !== 'PATIENT' && role !== 'ADMIN') {
        return { path: '/home', replace: true };
      }
    }

    return true;
  });
}
