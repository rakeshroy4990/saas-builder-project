import type { PageConfig } from '../../core/types/PageConfig';

/** Standard success dialog after patient prescription upload (GlobalPopup + hosp.popup.* templates). */
export const hospitalPrescriptionUploadSuccessPopupPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'prescription-upload-success-popup',
  title: 'Prescription uploaded',
  container: {
    layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-6'] },
    children: [
      {
        id: 'hospital-prescription-upload-success-header',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.popup.header',
          children: [
            {
              id: 'hospital-prescription-upload-success-title',
              type: 'text',
              config: {
                i18nKey: 'popup.prescriptionUploaded',
                styles: { styleTemplate: 'hosp.popup.header.title' }
              }
            }
          ]
        }
      },
      {
        id: 'hospital-prescription-upload-success-message',
        type: 'text',
        config: {
          i18nKey: 'popup.prescriptionUploadedMessage',
          styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'block text-center' }
        }
      },
      {
        id: 'hospital-prescription-upload-success-actions',
        type: 'container',
        config: {
          layout: {
            type: 'flex',
            flex: ['flex', 'flex-wrap', 'justify-center', 'items-center', 'gap-3']
          },
          children: [
            {
              id: 'hospital-prescription-upload-success-cancel',
              type: 'button',
              config: {
                i18nKey: 'common.cancel',
                styles: { styleTemplate: 'hosp.popup.button.secondary' },
                click: { actionType: 'closePopup' }
              }
            },
            {
              id: 'hospital-prescription-upload-success-view',
              type: 'button',
              config: {
                i18nKey: 'popup.prescriptionUploadedView',
                styles: { styleTemplate: 'hosp.popup.button.primary' },
                click: {
                  actionId: 'go-to-prescription-view-after-upload',
                  onSuccess: {
                    actionId: 'set-prescription-header-active',
                    onSuccess: { actionId: 'load-patient-prescriptions' }
                  }
                }
              }
            }
          ]
        }
      }
    ]
  }
};
