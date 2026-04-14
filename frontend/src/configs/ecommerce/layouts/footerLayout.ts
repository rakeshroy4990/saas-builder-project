import type { ComponentDefinition } from '../../../core/types/ComponentDefinition';

export type FooterLayoutOptions = {
  brandText?: string;
  copyText?: string;
};

/** Site footer block. */
export const createFooterLayer = (idPrefix: string, options?: FooterLayoutOptions): ComponentDefinition => ({
  id: `${idPrefix}-footer-section`,
  type: 'container',
  config: {
    styles: { styleTemplate: 'ecom.footer.surface' },
    layoutTemplate: 'ecom.footer.bar',
    children: [
      {
        id: `${idPrefix}-footer-brand`,
        type: 'text',
        config: {
          text: options?.brandText ?? 'URBAN CART',
          styles: { styleTemplate: 'ecom.footer.brand' }
        }
      },
      {
        id: `${idPrefix}-footer-copy`,
        type: 'text',
        config: {
          text:
            options?.copyText ??
            'Dynamic commerce UI - update menus, products, images, and theme from config.',
          styles: { styleTemplate: 'ecom.footer.copy' }
        }
      }
    ]
  }
});
