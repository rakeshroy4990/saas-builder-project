import type { PageConfig } from '../../core/types/PageConfig';
import { assembleStandardHomePage } from './layouts';

export const ecommercePages: PageConfig[] = [
  {
    packageName: 'ecommerce',
    pageId: 'home',
    title: 'Urban Cart Home',
    initializeActions: [{ actionId: 'load-home-content' }, { actionId: 'load-products' }],
    container: {
      styles: { styleTemplate: 'ecom.page.shell' },
      layoutTemplate: 'ecom.page.root',
      children: assembleStandardHomePage()
    }
  },
];
