import type { PageConfig } from '../../core/types/PageConfig';

export const hospitalPages: PageConfig[] = [
  {
    packageName: 'hospital',
    pageId: 'book-appointment',
    title: 'Book Appointment',
    initializeActions: [{ actionId: 'load-doctors' }],
    container: {
      layoutTemplate: 'flexshell.page.stack',
      children: [
        {
          id: 'hospital-book-appointment-page-heading',
          type: 'text',
          config: { text: 'Book an Appointment' }
        },
        {
          id: 'hospital-book-appointment-doctor-select',
          type: 'dropdown',
          config: {
            label: 'Select Doctor',
            mapping: { packageName: 'hospital', key: 'Doctors', property: 'list' }
          }
        },
        {
          id: 'hospital-book-appointment-preferred-date',
          type: 'input',
          config: { label: 'Preferred Date', inputType: 'date' }
        },
        {
          id: 'hospital-book-appointment-actions',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3', 'flex-wrap'] },
            children: [
              {
                id: 'hospital-book-appointment-submit',
                type: 'button',
                config: {
                  text: 'Book Now',
                  styles: { styleTemplate: 'semantic.button.primary' },
                  click: { actionId: 'book-appointment' }
                }
              },
              {
                id: 'hospital-book-appointment-login',
                type: 'button',
                config: {
                  text: 'Login',
                  styles: { styleTemplate: 'semantic.button.primary' }
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'patient-dashboard',
    title: 'Patient Dashboard',
    container: {
      layoutTemplate: 'flexshell.page.column',
      children: [
        {
          id: 'hospital-patient-dashboard-intro',
          type: 'text',
          config: { text: 'Patient dashboard' }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'doctor-overview',
    title: 'Doctor Overview',
    container: {
      layoutTemplate: 'flexshell.page.column',
      children: [
        {
          id: 'hospital-doctor-overview-intro',
          type: 'text',
          config: { text: 'Doctor overview' }
        }
      ]
    }
  }
];
