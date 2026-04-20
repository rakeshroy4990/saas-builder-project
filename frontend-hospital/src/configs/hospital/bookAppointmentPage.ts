import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

/** Shared edit form (dashboard full page + book-appointment-popup). */
const bookAppointmentEditFormGrid: ComponentDefinition = {
  id: 'hospital-book-appt-form-grid',
  type: 'container',
  config: {
    layout: { type: 'grid', grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4'] },
    children: [
      {
        id: 'hospital-book-appt-patient-name',
        type: 'input',
        config: {
          label: 'Patient Name *',
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'patientName' },
          change: { actionId: 'set-appointment-patient-field', data: { field: 'patientName' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-email',
        type: 'input',
        config: {
          label: 'Email Address *',
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'patientEmail' },
          change: { actionId: 'set-appointment-patient-field', data: { field: 'patientEmail' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-phone',
        type: 'input',
        config: {
          label: 'Phone Number *',
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'patientPhone' },
          change: { actionId: 'set-appointment-patient-field', data: { field: 'patientPhone' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-age',
        type: 'input',
        config: {
          label: 'Age (years) *',
          placeholder: 'Digits only, e.g. 25 or 72',
          inputType: 'text',
          inputMode: 'numeric',
          pattern: '[0-9]*',
          numericOnly: true,
          maxlength: 4,
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'ageGroup' },
          change: { actionId: 'set-appointment-age' },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-department',
        type: 'dropdown',
        config: {
          label: 'Department *',
          mapping: { packageName: 'hospital', key: 'AppointmentDepartments', property: 'list' },
          valueMapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'department' },
          change: { actionId: 'set-appointment-department' },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-doctor-disabled',
        type: 'dropdown',
        condition: {
          expression: "!department || String(department).trim().length === 0",
          mappings: {
            department: { packageName: 'hospital', key: 'AppointmentForm', property: 'department' }
          }
        },
        config: {
          label: 'Doctor (select department first) *',
          disabled: true,
          options: [],
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-doctor',
        type: 'dropdown',
        condition: {
          expression: "department && String(department).trim().length > 0",
          mappings: {
            department: { packageName: 'hospital', key: 'AppointmentForm', property: 'department' }
          }
        },
        config: {
          label: 'Doctor *',
          mapping: { packageName: 'hospital', key: 'AppointmentDoctors', property: 'list' },
          valueMapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctor' },
          change: { actionId: 'set-appointment-doctor' },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-doctor-err',
        type: 'text',
        condition: {
          expression: 'doctorLoadError && doctorLoadError.length > 0',
          mappings: {
            doctorLoadError: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctorLoadError' }
          }
        },
        config: {
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctorLoadError' },
          styles: { styleTemplate: 'hosp.form.errorText', utilityClasses: 'ml-0 md:col-start-2' }
        }
      },
      {
        id: 'hospital-book-appt-date',
        type: 'input',
        config: {
          label: 'Preferred Date *',
          inputType: 'date',
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'preferredDate' },
          change: { actionId: 'set-appointment-date' },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-slot-disabled',
        type: 'dropdown',
        condition: {
          expression:
            "!doctor || String(doctor).trim().length === 0 || !preferredDate || String(preferredDate).trim().length === 0",
          mappings: {
            doctor: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctor' },
            preferredDate: { packageName: 'hospital', key: 'AppointmentForm', property: 'preferredDate' }
          }
        },
        config: {
          label: 'Preferred Time Slot *',
          disabled: true,
          mapping: { packageName: 'hospital', key: 'AppointmentTimeSlots', property: 'list' },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-slot',
        type: 'dropdown',
        condition: {
          expression:
            "doctor && String(doctor).trim().length > 0 && preferredDate && String(preferredDate).trim().length > 0",
          mappings: {
            doctor: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctor' },
            preferredDate: { packageName: 'hospital', key: 'AppointmentForm', property: 'preferredDate' }
          }
        },
        config: {
          label: 'Preferred Time Slot *',
          mapping: { packageName: 'hospital', key: 'AppointmentTimeSlots', property: 'list' },
          valueMapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'preferredTimeSlot' },
          change: { actionId: 'set-appointment-time-slot' },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-slot-empty-hint',
        type: 'text',
        condition: {
          expression: 'slotAvailabilityMessage && String(slotAvailabilityMessage).trim().length > 0',
          mappings: {
            slotAvailabilityMessage: {
              packageName: 'hospital',
              key: 'AppointmentForm',
              property: 'slotAvailabilityMessage'
            }
          }
        },
        config: {
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'slotAvailabilityMessage' },
          styles: {
            utilityClasses: 'mt-1 block w-full text-left text-sm text-red-600 md:col-start-2'
          }
        }
      },
      {
        id: 'hospital-book-appt-notes',
        type: 'input',
        config: {
          label: 'Additional Notes',
          inputType: 'textarea',
          rows: 5,
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'additionalNotes' },
          change: { actionId: 'set-appointment-notes' },
          styles: { styleTemplate: 'hosp.form.textarea' }
        }
      },
      {
        id: 'hospital-book-appt-prescriptions',
        type: 'input',
        config: {
          label:
            'Prior documents / scans (optional, up to 2 images) — not the doctor-issued structured e-prescription',
          inputType: 'file',
          accept: 'image/*',
          multiple: true,
          change: { actionId: 'set-appointment-prescriptions' },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-book-appt-prescriptions-err',
        type: 'text',
        condition: {
          expression: 'prescriptionUploadError && prescriptionUploadError.length > 0',
          mappings: {
            prescriptionUploadError: {
              packageName: 'hospital',
              key: 'AppointmentForm',
              property: 'prescriptionUploadError'
            }
          }
        },
        config: {
          mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'prescriptionUploadError' },
          styles: { styleTemplate: 'hosp.form.errorText', utilityClasses: 'ml-0 md:col-start-2' }
        }
      }
    ]
  }
};

const bookAppointmentSaveButton: ComponentDefinition = {
  id: 'hospital-book-appt-save',
  type: 'button',
  config: {
    text: 'Save changes',
    styles: { styleTemplate: 'hosp.popup.button.primary' },
    click: { actionId: 'book-appointment' }
  }
};

/** Full-page edit (direct URL / legacy); dashboard edit uses the popup instead. */
export const hospitalBookAppointmentPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'book-appointment',
  title: 'Appointment',
  initializeActions: [{ actionId: 'set-dashboard-header-active' }, { actionId: 'init-book-appointment-page' }],
  container: {
    layoutTemplate: 'hosp.page.root',
    children: [
      ...hospitalPublicChromeTop,
      {
        id: 'hospital-book-appt-page-main',
        type: 'container',
        config: {
          styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col' },
          children: [
            {
              id: 'hospital-book-appt-shell',
              type: 'container',
              config: {
                styles: { utilityClasses: 'mx-auto max-w-4xl w-full px-4 py-6 sm:px-6' },
                children: [
                  {
                    id: 'hospital-book-appt-toolbar',
                    type: 'container',
                    config: {
                      layout: {
                        type: 'flex',
                        flex: ['flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3', 'mb-6']
                      },
                      children: [
                        {
                          id: 'hospital-book-appt-title',
                          type: 'text',
                          config: {
                            text: 'Edit appointment',
                            styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-2xl' }
                          }
                        },
                        {
                          id: 'hospital-book-appt-back',
                          type: 'button',
                          config: {
                            text: 'Back to dashboard',
                            styles: { styleTemplate: 'hosp.button.secondary' },
                            click: {
                              actionId: 'set-dashboard-header-active',
                              onSuccess: {
                                actionType: 'navigate',
                                navigate: { packageName: 'hospital', pageId: 'dashboard' }
                              }
                            }
                          }
                        }
                      ]
                    }
                  },
                  bookAppointmentEditFormGrid,
                  {
                    id: 'hospital-book-appt-actions',
                    type: 'container',
                    config: {
                      layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-end', 'gap-3', 'mt-6'] },
                      children: [bookAppointmentSaveButton]
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter(
        'hospital-book-appt-footer',
        'Little Sprouts Care | Update your appointment details.'
      )
    ]
  }
};

/** Dashboard “Edit appointment” — same form as full page, in a modal. */
export const hospitalBookAppointmentPopupPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'book-appointment-popup',
  title: 'Edit appointment',
  initializeActions: [{ actionId: 'init-book-appointment-popup' }],
  container: {
    layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4', 'max-h-[85vh]', 'overflow-y-auto'] },
    children: [
      {
        id: 'hospital-book-appt-popup-header',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.popup.header',
          children: [
            {
              id: 'hospital-book-appt-popup-title',
              type: 'text',
              config: { text: 'Edit appointment', styles: { styleTemplate: 'hosp.popup.header.title' } }
            },
            {
              id: 'hospital-book-appt-popup-close',
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
        id: 'hospital-book-appt-popup-divider',
        type: 'container',
        config: {
          styles: { utilityClasses: 'h-px w-full bg-slate-200' },
          children: []
        }
      },
      bookAppointmentEditFormGrid,
      {
        id: 'hospital-book-appt-popup-actions',
        type: 'container',
        config: {
          layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-end', 'gap-3', 'flex-wrap'] },
          children: [
            {
              id: 'hospital-book-appt-popup-cancel',
              type: 'button',
              config: {
                text: 'Cancel',
                styles: { styleTemplate: 'hosp.popup.button.secondary' },
                click: { actionType: 'closePopup' }
              }
            },
            bookAppointmentSaveButton
          ]
        }
      }
    ]
  }
};
