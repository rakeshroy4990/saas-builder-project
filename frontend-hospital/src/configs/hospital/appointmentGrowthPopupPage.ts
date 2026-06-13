import type { PageConfig } from '../../core/types/PageConfig';

export const hospitalAppointmentGrowthPopupPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'appointment-growth-popup',
  title: 'Record growth at visit',
  titleKey: 'growth.appointment.title',
  initializeActions: [{ actionId: 'hydrate-appointment-growth-popup' }],
  container: {
    layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4', 'max-h-[85vh]', 'overflow-y-auto'] },
    children: [
      {
        id: 'hospital-appointment-growth-header',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.popup.header',
          children: [
            {
              id: 'hospital-appointment-growth-title',
              type: 'text',
              config: {
                i18nKey: 'growth.appointment.title',
                styles: { styleTemplate: 'hosp.popup.header.title' }
              }
            },
            {
              id: 'hospital-appointment-growth-close',
              type: 'button',
              config: {
                text: 'X',
                styles: { styleTemplate: 'hosp.popup.header.closeButton' },
                click: { actionType: 'closePopup' }
              }
            }
          ]
        }
      },
      {
        id: 'hospital-appointment-growth-form',
        type: 'appointment-growth-form',
        config: {}
      }
    ]
  }
};
