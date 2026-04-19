/**
 * Auditable inventory for hospital route E2E. Keep in sync with {@link hospitalPages} pageIds
 * (see `hospitalRouteManifest.guard.spec.ts`).
 */
export type HospitalRouteManifestEntry = {
  pageId: string;
  packageName: 'hospital';
  /** Page shell is not stable at this URL for unauthenticated smoke (redirects, etc.). */
  skipRouteSmoke?: boolean;
  /** WebSocket / WebRTC / vendor flows — skipped in default route matrix. */
  skipHeavyIntegration?: boolean;
};

export const hospitalRouteManifest: HospitalRouteManifestEntry[] = [
  { packageName: 'hospital', pageId: 'home' },
  { packageName: 'hospital', pageId: 'terms' },
  { packageName: 'hospital', pageId: 'dashboard' },
  { packageName: 'hospital', pageId: 'patient-dashboard' },
  { packageName: 'hospital', pageId: 'doctor-overview' },
  { packageName: 'hospital', pageId: 'login-popup' },
  { packageName: 'hospital', pageId: 'register-popup' },
  { packageName: 'hospital', pageId: 'reset-password-popup' },
  { packageName: 'hospital', pageId: 'register-success-popup' },
  { packageName: 'hospital', pageId: 'appointment-popup' },
  { packageName: 'hospital', pageId: 'appointment-success-popup' },
  { packageName: 'hospital', pageId: 'book-appointment', skipRouteSmoke: true },
  { packageName: 'hospital', pageId: 'book-appointment-popup' },
  { packageName: 'hospital', pageId: 'profile', skipRouteSmoke: true },
  { packageName: 'hospital', pageId: 'appointment-receipts-popup' },
  { packageName: 'hospital', pageId: 'chat', skipHeavyIntegration: true },
  { packageName: 'hospital', pageId: 'chat-popup', skipHeavyIntegration: true },
  { packageName: 'hospital', pageId: 'doctor-working-slots', skipRouteSmoke: true },
  { packageName: 'hospital', pageId: 'video-call-popup', skipHeavyIntegration: true }
];
