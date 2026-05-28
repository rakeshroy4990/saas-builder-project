import type { PageConfig } from '../../core/types/PageConfig';

/** Confirm clinical file order before sending to education chat (GlobalPopup). */
export const hospitalEducationAttachmentSequencePopupPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'education-attachment-sequence-popup',
  title: 'Confirm file order',
  container: {
    layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-6'] },
    children: [
      {
        id: 'hospital-education-attachment-sequence-header',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.popup.header',
          children: [
            {
              id: 'hospital-education-attachment-sequence-title',
              type: 'text',
              config: {
                i18nKey: 'popup.educationAttachmentSequence.title',
                styles: { styleTemplate: 'hosp.popup.header.title' }
              }
            }
          ]
        }
      },
      {
        id: 'hospital-education-attachment-sequence-hint',
        type: 'text',
        config: {
          i18nKey: 'popup.educationAttachmentSequence.hint',
          styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'block text-center' }
        }
      },
      {
        id: 'hospital-education-attachment-sequence-list',
        type: 'education-attachment-sequence',
        config: {}
      },
      {
        id: 'hospital-education-attachment-sequence-actions',
        type: 'container',
        config: {
          layout: {
            type: 'flex',
            flex: ['flex', 'flex-wrap', 'justify-center', 'items-center', 'gap-3']
          },
          children: [
            {
              id: 'hospital-education-attachment-sequence-cancel',
              type: 'button',
              config: {
                i18nKey: 'common.cancel',
                styles: { styleTemplate: 'hosp.popup.button.secondary' },
                click: { actionType: 'closePopup' }
              }
            },
            {
              id: 'hospital-education-attachment-sequence-confirm',
              type: 'button',
              config: {
                i18nKey: 'popup.educationAttachmentSequence.confirm',
                styles: { styleTemplate: 'hosp.popup.button.primary' },
                click: {
                  actionId: 'confirm-education-attachment-sequence-send',
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
