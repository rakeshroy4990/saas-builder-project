import { router } from '../../../../router';
import { ServiceRegistry } from '../../../../core/registry/ServiceRegistry';

/** Runs `init-dashboard` when the current route is the hospital dashboard (post-login / locale onboarding). */
export async function runDashboardInitIfPresent(): Promise<void> {
  const path = String(router.currentRoute.value?.path ?? '');
  const onDashboard = path === '/dashboard' || path.endsWith('/dashboard');
  if (!onDashboard) {
    return;
  }
  const init = ServiceRegistry.getInstance().get('hospital', 'init-dashboard');
  if (!init) {
    return;
  }
  try {
    await init.execute({ data: {} });
  } catch {
    /* ignore */
  }
}
