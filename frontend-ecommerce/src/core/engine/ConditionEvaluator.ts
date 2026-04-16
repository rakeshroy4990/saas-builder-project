import type { ConditionConfig } from '../types/ComponentDefinition';
import { resolveMappings } from './DataMapper';

export function evaluateCondition(condition: ConditionConfig): boolean {
  const values = resolveMappings(condition.mappings ?? {});
  const keys = Object.keys(values);
  const args = Object.values(values);

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `return Boolean(${condition.expression});`) as (
      ...params: unknown[]
    ) => boolean;
    return fn(...args);
  } catch (_error) {
    return false;
  }
}
