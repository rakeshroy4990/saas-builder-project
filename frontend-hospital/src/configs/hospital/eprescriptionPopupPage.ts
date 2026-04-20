import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';

const eprescriptionFormGrid: ComponentDefinition = {
  id: 'hospital-eprx-form-grid',
  type: 'container',
  config: {
    layout: { type: 'grid', grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4'] },
    children: [
      {
        id: 'hospital-eprx-consult-mode',
        type: 'dropdown',
        config: {
          label: 'Consultation mode *',
          mapping: { packageName: 'hospital', key: 'PrescriptionConsultationModeOptions', property: 'list' },
          valueMapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'consultationMode' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'consultationMode' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-consult-dt',
        type: 'input',
        config: {
          label: 'Consultation date & time (ISO) *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'consultationDateTime' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'consultationDateTime' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-clinic-name',
        type: 'input',
        config: {
          label: 'Clinic / hospital name *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'clinicName' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'clinicName' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-clinic-phone',
        type: 'input',
        config: {
          label: 'Clinic phone *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'clinicPhone' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'clinicPhone' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-clinic-address',
        type: 'input',
        config: {
          label: 'Clinic address *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'clinicAddress' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'clinicAddress' } },
          styles: { styleTemplate: 'hosp.form.input', utilityClasses: 'md:col-span-2' }
        }
      },
      {
        id: 'hospital-eprx-dr-name',
        type: 'input',
        config: {
          label: 'Doctor display name *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'prescriberDisplayName' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'prescriberDisplayName' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-dr-qual',
        type: 'input',
        config: {
          label: 'Qualifications *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'prescriberQualifications' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'prescriberQualifications' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-smc',
        type: 'input',
        config: {
          label: 'State Medical Council *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'smcName' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'smcName' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-smc-reg',
        type: 'input',
        config: {
          label: 'SMC registration number *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'smcReg' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'smcReg' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-pt-name',
        type: 'input',
        config: {
          label: 'Patient name *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'patientName' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'patientName' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-pt-age',
        type: 'input',
        config: {
          label: 'Patient age or DOB *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'patientAgeOrDob' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'patientAgeOrDob' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-pt-sex',
        type: 'input',
        config: {
          label: 'Patient sex *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'patientSex' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'patientSex' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-pt-phone',
        type: 'input',
        config: {
          label: 'Patient phone *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'patientPhone' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'patientPhone' } },
          styles: { styleTemplate: 'hosp.form.input' }
        }
      },
      {
        id: 'hospital-eprx-pt-address',
        type: 'input',
        config: {
          label: 'Patient address *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'patientAddress' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'patientAddress' } },
          styles: { styleTemplate: 'hosp.form.input', utilityClasses: 'md:col-span-2' }
        }
      },
      {
        id: 'hospital-eprx-meds',
        type: 'input',
        config: {
          label: 'Medicines (JSON array) *',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'medicinesJson' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'medicinesJson' } },
          styles: { styleTemplate: 'hosp.form.input', utilityClasses: 'md:col-span-2 font-mono text-xs' }
        }
      },
      {
        id: 'hospital-eprx-gen',
        type: 'input',
        config: {
          label: 'General advice',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'generalAdvice' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'generalAdvice' } },
          styles: { styleTemplate: 'hosp.form.input', utilityClasses: 'md:col-span-2' }
        }
      },
      {
        id: 'hospital-eprx-follow',
        type: 'input',
        config: {
          label: 'Follow-up advice',
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'followUpAdvice' },
          change: { actionId: 'set-prescription-editor-field', data: { field: 'followUpAdvice' } },
          styles: { styleTemplate: 'hosp.form.input', utilityClasses: 'md:col-span-2' }
        }
      },
      {
        id: 'hospital-eprx-validation',
        type: 'text',
        condition: {
          expression: 'String(validationSummary ?? "").trim().length > 0',
          mappings: {
            validationSummary: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'validationSummary' }
          }
        },
        config: {
          mapping: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'validationSummary' },
          styles: { utilityClasses: 'md:col-span-2 whitespace-pre-wrap text-xs text-slate-700' }
        }
      }
    ]
  }
};

export const hospitalEprescriptionPopupPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'eprescription-popup',
  title: 'Structured e-prescription',
  initializeActions: [{ actionId: 'hydrate-eprescription-popup' }],
  container: {
    layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4', 'max-h-[85vh]', 'overflow-y-auto'] },
    children: [
      {
        id: 'hospital-eprx-popup-header',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.popup.header',
          children: [
            {
              id: 'hospital-eprx-popup-title',
              type: 'text',
              config: { text: 'Structured e-prescription', styles: { styleTemplate: 'hosp.popup.header.title' } }
            },
            {
              id: 'hospital-eprx-popup-close',
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
        id: 'hospital-eprx-legal',
        type: 'text',
        config: {
          text: 'Legal: this tool does not replace counsel-approved telemedicine, schedule (H/H1/X), or CA/eSign workflows. The current signer is a non-evidentiary placeholder until a licensed ASP is integrated.',
          styles: { utilityClasses: 'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950' }
        }
      },
      eprescriptionFormGrid,
      {
        id: 'hospital-eprx-actions',
        type: 'container',
        config: {
          layout: { type: 'flex', flex: ['flex', 'flex-wrap', 'items-center', 'justify-end', 'gap-2'] },
          children: [
            {
              id: 'hospital-eprx-save',
              type: 'button',
              condition: {
                expression: 'String(draftEditable ?? "").toUpperCase() === "Y"',
                mappings: {
                  draftEditable: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'draftEditable' }
                }
              },
              config: {
                text: 'Save draft',
                styles: { styleTemplate: 'hosp.popup.button.secondary' },
                click: { actionId: 'save-eprescription-draft' }
              }
            },
            {
              id: 'hospital-eprx-validate',
              type: 'button',
              condition: {
                expression: 'String(draftEditable ?? "").toUpperCase() === "Y"',
                mappings: {
                  draftEditable: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'draftEditable' }
                }
              },
              config: {
                text: 'Validate',
                styles: { styleTemplate: 'hosp.popup.button.secondary' },
                click: { actionId: 'validate-eprescription' }
              }
            },
            {
              id: 'hospital-eprx-finalize',
              type: 'button',
              condition: {
                expression: 'String(draftEditable ?? "").toUpperCase() === "Y"',
                mappings: {
                  draftEditable: { packageName: 'hospital', key: 'PrescriptionEditor', property: 'draftEditable' }
                }
              },
              config: {
                text: 'Finalize & sign (placeholder)',
                styles: { styleTemplate: 'hosp.popup.button.primary' },
                click: { actionId: 'finalize-eprescription' }
              }
            }
          ]
        }
      }
    ]
  }
};
