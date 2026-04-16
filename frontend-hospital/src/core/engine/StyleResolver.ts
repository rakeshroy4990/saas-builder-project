import type { StyleConfig } from '../types/StyleConfig';
import { StyleTemplateRegistry } from './StyleTemplateRegistry';

const MAX_TEMPLATE_DEPTH = 48;

function resolveStyleAtoms(config: StyleConfig): string {
  const classes: string[] = [];
  if (config.utilityClasses) classes.push(config.utilityClasses);
  if (config.size?.width) classes.push(config.size.width);
  if (config.size?.height) classes.push(config.size.height);
  if (config.spacing?.padding) classes.push(config.spacing.padding);
  if (config.spacing?.margin) classes.push(config.spacing.margin);
  if (config.typography?.fontSize) classes.push(config.typography.fontSize);
  if (config.typography?.fontWeight) classes.push(config.typography.fontWeight);
  if (config.typography?.color) classes.push(config.typography.color);
  if (config.background?.color) classes.push(config.background.color);
  if (config.border?.radius) classes.push(config.border.radius);
  if (config.border?.width) classes.push(config.border.width);
  if (config.border?.color) classes.push(config.border.color);
  if (config.display?.overflow) classes.push(config.display.overflow);
  if (config.display?.position) classes.push(config.display.position);
  if (config.display?.objectFit) classes.push(config.display.objectFit);
  return classes.filter(Boolean).join(' ');
}

/**
 * Resolves Tailwind-style utility classes from style templates and optional atoms.
 * Template composition is recursive; cycles are skipped per branch.
 */
export function resolveStyle(config?: StyleConfig, extra?: string[], depth = 0): string {
  if (!config) return (extra ?? []).filter(Boolean).join(' ');

  if (depth > MAX_TEMPLATE_DEPTH) {
    return [...(extra ?? [])].filter(Boolean).join(' ');
  }

  const templateNames = [
    ...(config.styleTemplate ? [config.styleTemplate] : []),
    ...(config.styleTemplates ?? [])
  ];

  const chunks: string[] = [];

  for (const name of templateNames) {
    const inner = StyleTemplateRegistry.get(name);
    if (inner) {
      chunks.push(resolveStyle(inner, undefined, depth + 1));
    }
  }

  chunks.push(resolveStyleAtoms(config));
  chunks.push(...(extra ?? []));

  return chunks.filter(Boolean).join(' ');
}
