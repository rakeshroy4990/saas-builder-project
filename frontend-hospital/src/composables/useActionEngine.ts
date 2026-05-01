import { useRouter } from 'vue-router';
import { ActionEngine } from '../core/engine/ActionEngine';
import type { ActionConfig, ActionRunTelemetryContext } from '../core/types/ActionConfig';
import type { PageConfig } from '../core/types/PageConfig';

export function useActionEngine(pageConfig: PageConfig) {
  const router = useRouter();
  const engine = new ActionEngine(pageConfig, router);

  const execute = (
    action: ActionConfig,
    inputData?: Record<string, unknown>,
    runTelemetry?: ActionRunTelemetryContext
  ) => engine.execute(action, inputData, runTelemetry);

  return { execute };
}
