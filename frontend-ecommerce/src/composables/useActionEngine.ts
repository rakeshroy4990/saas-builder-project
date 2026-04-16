import { useRouter } from 'vue-router';
import { ActionEngine } from '../core/engine/ActionEngine';
import type { ActionConfig } from '../core/types/ActionConfig';
import type { PageConfig } from '../core/types/PageConfig';

export function useActionEngine(pageConfig: PageConfig) {
  const router = useRouter();
  const engine = new ActionEngine(pageConfig, router);

  const execute = (action: ActionConfig, inputData?: Record<string, unknown>) =>
    engine.execute(action, inputData);

  return { execute };
}
