import type { ConditionConfig } from '../types/ComponentDefinition';
import { resolveMappings } from './DataMapper';

/**
 * Evaluates a declarative condition. When `context` is provided (e.g. list row data),
 * its keys are available in the expression; store `mappings` override context on key clashes.
 */
export function evaluateCondition(
  condition: ConditionConfig,
  context?: Record<string, unknown>
): boolean {
  const fromStore = resolveMappings(condition.mappings ?? {});
  const merged: Record<string, unknown> = { ...(context ?? {}), ...fromStore };

  try {
    // Do not use `new Function(...Object.keys(merged), ...)`: list rows include keys like
    // `constructor` or other invalid/reserved identifiers, which throws and yields false.
    // Sloppy-mode function (Function default) so `with` works; expression only sees merged keys.
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
