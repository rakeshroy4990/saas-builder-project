import type { PageConfig } from '../../core/types/PageConfig';

/** Soft-block before video call when no recent triage exists. */
export const triageSoftBlockPopupPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'triage-soft-block-popup',
  title: 'Check symptoms before your visit?',
  titleKey: 'triage.softBlockTitle',
  container: {
    layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-6'] },
    children: [
      {
        id: 'triage-soft-block-header',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.popup.header',
          children: [
            {
              id: 'triage-soft-block-title',
              type: 'text',
              config: {
                i18nKey: 'triage.softBlockTitle',
                styles: { styleTemplate: 'hosp.popup.header.title' }
              }
            }
          ]
        }
      },
      {
        id: 'triage-soft-block-message',
        type: 'text',
        config: {
          i18nKey: 'triage.softBlockMessage',
          styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'block text-center' }
        }
      },
      {
        id: 'triage-soft-block-actions',
        type: 'container',
        config: {
          layout: {
            type: 'flex',
            flex: ['flex', 'flex-wrap', 'justify-center', 'items-center', 'gap-3']
          },
          children: [
            {
              id: 'triage-soft-block-skip',
              type: 'button',
              config: {
                i18nKey: 'triage.continueWithoutTriage',
                styles: { styleTemplate: 'hosp.popup.button.secondary' },
                click: { actionId: 'triage-soft-block-continue' }
              }
            },
            {
              id: 'triage-soft-block-primary',
              type: 'button',
              config: {
                i18nKey: 'triage.checkSymptomsFirst',
                styles: { styleTemplate: 'hosp.popup.button.primary' },
                click: {
                  actionId: 'open-triage-page',
                  onSuccess: { actionType: 'closePopup' }
                }
              }
            }
          ]
        }
      }
    ]
  }
};
