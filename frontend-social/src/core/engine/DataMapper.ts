import type { MappingConfig } from '../types/MappingConfig';
import { useAppStore } from '../../store/useAppStore';

function getByPath(source: unknown, path?: string): unknown {
  if (!path) return source;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function resolveMapping(mapping: MappingConfig): unknown {
  const store = useAppStore();
  const packageData = store.getData(mapping.packageName, mapping.key);
  const base = getByPath(packageData, mapping.path);
  const value = getByPath(base, mapping.property);
  if (mapping.hideNil && (value === null || value === undefined)) return '';
  return value;
}

export function resolveMappings(mappings: Record<string, MappingConfig>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(mappings).map(([key, mapping]) => [key, resolveMapping(mapping)])
  );
}
