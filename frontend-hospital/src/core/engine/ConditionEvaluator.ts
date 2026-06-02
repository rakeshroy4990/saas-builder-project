import type { ConditionConfig } from '../types/ComponentDefinition';
import { resolveMappings } from './DataMapper';
import { useDynamicConfigStore, useStaticConfigStore } from '@saas-builder/extensibility-vue';

/**
 * Evaluates a declarative condition. When `context` is provided (e.g. list row data),
 * its keys are available in the expression; store `mappings` override context on key clashes.
 */
export function evaluateCondition(
  condition: ConditionConfig,
  context?: Record<string, unknown>
): boolean {
  if (condition.flag) {
    const staticStore = useStaticConfigStore();
    const dynStore = useDynamicConfigStore();
    const flagName = condition.flag;
    if (dynStore.config.flags && flagName in dynStore.config.flags) {
      return Boolean(dynStore.config.flags[flagName]);
    }
    return staticStore.isFlagEnabled(flagName);
  }

  if (!condition.expression?.trim()) {
    return true;
  }

  const fromStore = resolveMappings(condition.mappings ?? {});
  const merged: Record<string, unknown> = { ...(context ?? {}), ...fromStore };

  try {
    // eslint-disable-next-line no-new-func, no-with
    const fn = new Function(
      'merged',
      'with (merged) {\n  return Boolean(' + condition.expression + ');\n}'
    ) as (m: Record<string, unknown>) => boolean;
    return fn(merged);
  } catch (_error) {
    return false;
  }
}
