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
  {
    packageName: 'ecommerce',
    pageId: 'chat-popup',
    title: 'Chat',
    initializeActions: [{ actionId: 'chat-connect' }],
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'h-full', 'min-h-0'] },
      children: [
        {
          id: 'ecom-chat-popup-header',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-between'] },
            styles: { utilityClasses: 'px-4 py-3 border-b border-slate-200' },
            children: [
              {
                id: 'ecom-chat-popup-title',
                type: 'text',
                config: { text: 'Ask a question', styles: { utilityClasses: 'text-lg font-semibold text-slate-900' } }
              },
              {
                id: 'ecom-chat-popup-close',
                type: 'button',
                config: {
                  text: 'X',
                  styles: { utilityClasses: 'rounded border border-slate-300 px-3 py-1 text-sm' },
                  click: { actionType: 'closePopup' }
                }
              }
            ]
          }
        },
        {
          id: 'ecom-chat-popup-body-shell',
          type: 'container',
          config: {
            styles: { utilityClasses: 'flex-1 min-h-0' },
            children: [
              {
                id: 'ecom-chat-popup-body',
                type: 'chat',
                config: {
                  packageName: 'ecommerce',
                  storeKey: 'Chat',
                  startChatAction: { actionId: 'chat-start' },
                  sendMessageAction: { actionId: 'chat-send-message' },
                  supportUserId: 'support',
                  embedded: true,
                  styles: { utilityClasses: 'w-full h-full min-h-0' }
                }
              }
            ]
          }
        }
      ]
    }
  }
];
