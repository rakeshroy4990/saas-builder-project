import type { StaticConfig } from '@saas-builder/extensibility-contract';

export type StyleTemplateRegistrar = (
  key: string,
  template: { utilityClasses?: string; background?: { color?: string } }
) => void;

/**
 * Overlay L1 brand tokens onto known FlexShell style template keys.
 * Apps pass their StyleTemplateRegistry.register binding.
 */
export function seedStyleTemplatesFromStaticConfig(
  config: StaticConfig,
  register: StyleTemplateRegistrar
): void {
  const primary = config.brand.colors.primary ?? '#0F6B5E';
  const bodyFont = config.brand.fonts.body ?? "'DM Sans', sans-serif";

  register('hosp.brand.primary.bg', {
    background: { color: `bg-[${primary}]` }
  });
  register('hosp.brand.primary.text', {
    utilityClasses: `text-[${primary}]`
  });
  register('hosp.brand.body.font', {
    utilityClasses: `font-sans`
  });

  register('extensibility.brand.logo', {
    utilityClasses: 'h-10 w-auto max-w-[180px] object-contain'
  });

  void bodyFont;
}
