import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

const prescriptionNavButtonStyles = {
  active:
    'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm',
  inactive:
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50'
};

function prescriptionNavButton(
  id: string,
  tab: 'upload' | 'view',
  active: boolean,
  i18nKey: string,
  extraOnSuccess?: Record<string, unknown>
): Record<string, unknown> {
  const navAction = tab === 'upload' ? 'set-prescription-nav-upload' : 'set-prescription-nav-view';
  const onSuccessChain: Record<string, unknown> = {
    actionId: navAction,
    onSuccess: {
      actionId: 'set-prescription-header-active',
      ...(extraOnSuccess ? { onSuccess: extraOnSuccess } : {})
    }
  };
  return {
    id,
    type: 'button',
    condition: {
      expression: active
        ? `String(activeItem ?? '') === '${tab}'`
        : `String(activeItem ?? '') !== '${tab}'`,
      mappings: {
        activeItem: { packageName: 'hospital', key: 'PrescriptionNav', property: 'activeItem' }
      }
    },
    config: {
      i18nKey,
      styles: { utilityClasses: active ? prescriptionNavButtonStyles.active : prescriptionNavButtonStyles.inactive },
      click: {
        actionId: 'require-hospital-prescription-session',
        data: { tab },
        onSuccess: onSuccessChain
      }
    }
  };
}

export const hospitalPrescriptionsPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'prescriptions',
  title: 'Prescriptions',
  titleKey: 'page.prescriptions.title',
  initializeActions: [{ actionId: 'set-prescription-header-active' }, { actionId: 'init-prescriptions' }],
  container: {
    layoutTemplate: 'hosp.page.root',
    children: [
      ...hospitalPublicChromeTop,
      {
        id: 'hospital-prescriptions-content-shell',
        type: 'container',
        config: {
          layout: { type: 'grid', grid: ['grid', 'grid-cols-12', 'gap-4', 'items-start'] },
          styles: { utilityClasses: 'w-full flex-1 min-h-0' },
          children: [
            {
              id: 'hospital-prescriptions-left-menu',
              type: 'container',
              config: {
                styles: {
                  utilityClasses:
                    'col-span-12 lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3 space-y-2'
                },
                children: [
                  prescriptionNavButton(
                    'hospital-prescriptions-menu-upload-active',
                    'upload',
                    true,
                    'prescriptions.nav.upload'
                  ),
                  prescriptionNavButton(
                    'hospital-prescriptions-menu-upload-inactive',
                    'upload',
                    false,
                    'prescriptions.nav.upload'
                  ),
                  prescriptionNavButton(
                    'hospital-prescriptions-menu-view-active',
                    'view',
                    true,
                    'prescriptions.nav.view',
                    { actionId: 'load-patient-prescriptions' }
                  ),
                  prescriptionNavButton(
                    'hospital-prescriptions-menu-view-inactive',
                    'view',
                    false,
                    'prescriptions.nav.view',
                    { actionId: 'load-patient-prescriptions' }
                  )
                ]
              }
            },
            {
              id: 'hospital-prescriptions-main',
              type: 'container',
              config: {
                styles: {
                  utilityClasses: 'col-span-12 lg:col-span-10 rounded-xl border border-slate-200 bg-white p-4'
                },
                children: [
                  {
                    id: 'hospital-prescription-panel-upload',
                    type: 'prescription-upload',
                    condition: {
                      expression: "String(activeItem ?? '') === 'upload'",
                      mappings: {
                        activeItem: { packageName: 'hospital', key: 'PrescriptionNav', property: 'activeItem' }
                      }
                    },
                    config: {}
                  },
                  {
                    id: 'hospital-prescription-panel-view',
                    type: 'prescription-list',
                    condition: {
                      expression: "String(activeItem ?? '') === 'view'",
                      mappings: {
                        activeItem: { packageName: 'hospital', key: 'PrescriptionNav', property: 'activeItem' }
                      }
                    },
                    config: {}
                  }
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter('hospital-prescriptions-footer', '', {
        taglineI18nKey: 'footer.tagline.prescriptions'
      })
    ]
  }
};
