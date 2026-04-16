import { LayoutTemplateRegistry } from '../registry/LayoutTemplateRegistry';
import type { LayoutConfig } from '../types/ComponentDefinition';

/**
 * Resolves `layoutTemplate` from the registry, falling back to inline `layout`.
 */
export function resolveLayout(
  layoutTemplate?: string,
  fallback?: LayoutConfig
): LayoutConfig | undefined {
  if (layoutTemplate) {
    const resolved = LayoutTemplateRegistry.get(layoutTemplate);
    if (resolved) return resolved;
  }
  return fallback;
}
