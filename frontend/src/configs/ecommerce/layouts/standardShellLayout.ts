import type { ComponentDefinition } from '../../../core/types/ComponentDefinition';
import { createFooterLayer, type FooterLayoutOptions } from './footerLayout';
import { createHeaderLayer, type HeaderLayoutOptions } from './headerLayout';
import { createMenuLayer } from './menuLayout';
import { createStandardMainOutlet } from './mainOutletLayout';

export type StandardUiChromeOptions = {
  header?: HeaderLayoutOptions;
  menuLabel?: string;
  includeMenu?: boolean;
  includeFooter?: boolean;
  footer?: FooterLayoutOptions;
};

/**
 * Composes the default ecommerce chrome: header → menu → main outlet → footer.
 * Each piece also exists as its own module (`headerLayout`, `menuLayout`, etc.) if you
 * need a custom order or subset.
 */
export const buildStandardUiChrome = (
  idPrefix: string,
  outletChildren: ComponentDefinition[],
  options?: StandardUiChromeOptions
): ComponentDefinition[] => {
  const includeMenu = options?.includeMenu !== false;
  const includeFooter = options?.includeFooter !== false;
  const parts: ComponentDefinition[] = [createHeaderLayer(idPrefix, options?.header)];
  if (includeMenu) {
    parts.push(createMenuLayer(idPrefix, options?.menuLabel));
  }
  parts.push(createStandardMainOutlet(idPrefix, outletChildren));
  if (includeFooter) {
    parts.push(createFooterLayer(idPrefix, options?.footer));
  }
  return parts;
};
