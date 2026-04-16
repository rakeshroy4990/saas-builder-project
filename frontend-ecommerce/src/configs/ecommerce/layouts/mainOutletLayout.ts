import type { ComponentDefinition } from '../../../core/types/ComponentDefinition';

/**
 * Primary content region (`<main>` body). Pass page-specific blocks as `outletChildren`.
 */
export const createStandardMainOutlet = (
  idPrefix: string,
  outletChildren: ComponentDefinition[]
): ComponentDefinition => ({
  id: `${idPrefix}-standard-main-outlet`,
  type: 'container',
  config: {
    layoutTemplate: 'ecom.main.outlet',
    styles: { styleTemplate: 'ecom.main.outlet.pad' },
    children: outletChildren
  }
});
