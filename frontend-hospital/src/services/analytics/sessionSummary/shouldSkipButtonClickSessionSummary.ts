import type { ActionConfig, ActionRunTelemetryContext } from '../../../core/types/ActionConfig';

/** Header chrome clicks are not useful in session summary and bloat logout flush payloads. */
const SKIP_ACTION_IDS = new Set(['toggle-profile-header-menu', 'logout-user']);

function isHeaderChromeComponent(componentId: string): boolean {
  return (
    componentId.includes('hospital-public-header-user-menu') ||
    componentId.includes('hospital-public-header-user-display') ||
    componentId.includes('hospital-public-header-user-anchor')
  );
}

export function shouldSkipButtonClickSessionSummary(
  action: ActionConfig,
  runTelemetry?: ActionRunTelemetryContext
): boolean {
  if (!runTelemetry?.component_id?.trim()) return true;
  const actionId = String(action.actionId ?? '').trim();
  if (SKIP_ACTION_IDS.has(actionId)) return true;
  if (isHeaderChromeComponent(runTelemetry.component_id)) return true;
  return false;
}

/** Shorter ids for telemetry (full config path is still used in DOM). */
export function shortenTelemetryComponentId(componentId: string): string {
  const id = componentId.trim();
  if (!id) return id;
  if (id.includes('hospital-public-header')) {
    const parts = id.split('--');
    const leaf = parts[parts.length - 1] ?? id;
    return leaf.length > 0 ? leaf : id;
  }
  return id.length > 96 ? id.slice(-96) : id;
}
