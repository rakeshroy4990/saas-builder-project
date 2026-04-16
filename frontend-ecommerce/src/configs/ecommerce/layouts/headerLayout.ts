import type { ComponentDefinition } from '../../../core/types/ComponentDefinition';

export type HeaderLayoutOptions = {
  cartTargetPageId?: string;
  brandText?: string;
  logoSrc?: string;
  loginText?: string;
  homeLabel?: string;
  shopLabel?: string;
};

/** Reusable site header block (logo, nav, search, login, cart). */
export const createHeaderLayer = (idPrefix: string, options?: HeaderLayoutOptions): ComponentDefinition => ({
  id: `${idPrefix}-header-section`,
  type: 'container',
  config: {
    layoutTemplate: 'ecom.header.section',
    children: [
      {
        id: `${idPrefix}-top-brand-row`,
        type: 'container',
        config: {
          layoutTemplate: 'ecom.header.card',
          children: [
            {
              id: `${idPrefix}-brand-group`,
              type: 'container',
              config: {
                layoutTemplate: 'ecom.header.brand.row',
                children: [
                  {
                    id: `${idPrefix}-brand-icon`,
                    type: 'image',
                    config: {
                      src: options?.logoSrc ?? 'sea_xgqlrq.jpg',
                      styles: { styleTemplate: 'ecom.header.logo' }
                    }
                  },
                  {
                    id: `${idPrefix}-brand-title`,
                    type: 'text',
                    config: {
                      text: options?.brandText ?? 'URBAN CART',
                      styles: { styleTemplate: 'ecom.header.brandTitle' }
                    }
                  }
                ]
              }
            },
            {
              id: `${idPrefix}-nav-group`,
              type: 'container',
              config: {
                layoutTemplate: 'ecom.header.nav.row',
                children: [
                  {
                    id: `${idPrefix}-nav-home`,
                    type: 'button',
                    config: {
                      text: options?.homeLabel ?? 'Home',
                      styles: { styleTemplate: 'ecom.header.navButton' },
                      click: { actionType: 'navigate', navigate: { packageName: 'ecommerce', pageId: 'home' } }
                    }
                  },
                  {
                    id: `${idPrefix}-nav-shop`,
                    type: 'button',
                    config: {
                      text: options?.shopLabel ?? 'Shop',
                      styles: { styleTemplate: 'ecom.header.navButton' },
                      click: { actionType: 'navigate', navigate: { packageName: 'ecommerce', pageId: 'home' } }
                    }
                  }
                ]
              }
            },
            {
              id: `${idPrefix}-actions-group`,
              type: 'container',
              config: {
                layoutTemplate: 'ecom.header.actions.row',
                children: [
                  {
                    id: `${idPrefix}-search-wrap`,
                    type: 'container',
                    config: {
                      layoutTemplate: 'ecom.header.search.wrap',
                      children: [
                        {
                          id: `${idPrefix}-search-input`,
                          type: 'input',
                          config: {
                            placeholder: 'Search',
                            styles: { styleTemplate: 'ecom.header.searchInput' }
                          }
                        },
                        {
                          id: `${idPrefix}-search-icon`,
                          type: 'text',
                          config: {
                            text: '🔍',
                            styles: { styleTemplate: 'ecom.header.searchIcon' }
                          }
                        }
                      ]
                    }
                  },
                  {
                    id: `${idPrefix}-login-btn`,
                    type: 'button',
                    config: {
                      text: options?.loginText ?? 'Login / Logout',
                      styles: { styleTemplate: 'ecom.header.loginButton' }
                    }
                  },
                  {
                    id: `${idPrefix}-cart-btn`,
                    type: 'button',
                    config: {
                      text: '🛒',
                      styles: { styleTemplate: 'ecom.header.cartButton' },
                      click: {
                        actionType: 'navigate',
                        navigate: { packageName: 'ecommerce', pageId: options?.cartTargetPageId ?? 'cart' }
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
});
