import { getMobileApiBaseUrl } from '@/api/config';

let warmInFlight: Promise<void> | null = null;

/**
 * Wakes Cloud Run before the user taps sign-in so `/api/auth/google-login` is less likely to cold-start.
 * Fire-and-forget; safe to call on every login screen visit.
 */
export function warmAuthBackend(): void {
  if (warmInFlight) return;
  warmInFlight = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      await fetch(`${getMobileApiBaseUrl()}/actuator/health`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeout);
    } catch {
      // Non-fatal — sign-in still works if warm-up fails
    } finally {
      warmInFlight = null;
    }
  })();
}
