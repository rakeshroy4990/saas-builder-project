import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';

import { emitLoggedInSessionSummary } from '@/analytics/sessionTelemetry';

/** Records screen navigations into session_summary when the user is logged in. */
export function SessionNavigationTelemetry() {
  const pathname = usePathname();
  const lastRef = useRef<string>('');

  useEffect(() => {
    const path = String(pathname ?? '').trim();
    if (!path || path === lastRef.current) return;
    lastRef.current = path;
    void emitLoggedInSessionSummary({
      kind: 'navigate',
      package_name: 'mobile-hospital',
      route_path: path
    });
  }, [pathname]);

  return null;
}
