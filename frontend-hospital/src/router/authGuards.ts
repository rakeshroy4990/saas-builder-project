import type { Router } from 'vue-router';
import {
  hospitalPageRequiresAuth,
  hospitalPageRoleAllowed,
  hospitalSessionUserId,
  openHospitalLoginPopup
} from '../services/auth/hospitalLoginGate';

/**
 * Blocks unauthenticated navigation to sensitive hospital routes (direct URL / bookmark).
 */
export function registerHospitalRouteGuards(router: Router): void {
  router.beforeEach((to) => {
    if (to.meta?.public === true) return true;
    if (to.path.startsWith('/_')) return true;

    const pageId = String(to.params.pageId ?? '').trim();
    if (!pageId || !hospitalPageRequiresAuth(pageId)) {
      return true;
    }

    if (!hospitalSessionUserId()) {
      openHospitalLoginPopup();
      return { path: '/home', replace: true };
    }

    if (!hospitalPageRoleAllowed(pageId)) {
      return { path: '/home', replace: true };
    }

    return true;
  });
}
