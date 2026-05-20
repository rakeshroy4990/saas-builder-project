import type { ConditionConfig } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

const patientDashNavActive = (section: string): ConditionConfig => ({
  expression: `String(activeItem ?? '') === '${section}'`,
  mappings: {
    activeItem: { packageName: 'hospital', key: 'PatientDashboardNav', property: 'activeItem' }
  }
});

const patientDashNavInactive = (section: string): ConditionConfig => ({
  expression: `String(activeItem ?? '') !== '${section}'`,
  mappings: {
    activeItem: { packageName: 'hospital', key: 'PatientDashboardNav', property: 'activeItem' }
  }
});

const navBtnActive =
  'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm';
const navBtnInactive =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50';

export const hospitalPatientDashboardPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'patient-dashboard',
  title: 'Patient Dashboard',
  titleKey: 'page.patientDashboard.title',
  initializeActions: [
    { actionId: 'set-dashboard-header-active' },
    { actionId: 'load-home-content' },
    { actionId: 'init-patient-dashboard-nav' }
  ],
  container: {
    layoutTemplate: 'hosp.page.root',
    children: [
      ...hospitalPublicChromeTop,
      {
        id: 'hospital-patient-dashboard-shell',
        type: 'container',
        config: {
          styles: { utilityClasses: 'w-full flex-1 min-h-0 px-4 py-6 sm:px-6' },
          children: [
            {
              id: 'hospital-patient-dashboard-grid',
              type: 'container',
              config: {
                layout: { type: 'grid', grid: ['grid', 'grid-cols-12', 'gap-4', 'items-start'] },
                styles: { utilityClasses: 'w-full flex-1 min-h-0' },
                children: [
                  {
                    id: 'hospital-patient-dashboard-left-menu',
                    type: 'container',
                    config: {
                      styles: {
                        utilityClasses:
                          'col-span-12 md:col-span-2 rounded-xl border border-slate-200 bg-white p-3 space-y-2'
                      },
                      children: [
                        {
                          id: 'hospital-patient-dashboard-nav-overview-active',
                          type: 'button',
                          condition: patientDashNavActive('overview'),
                          config: {
                            i18nKey: 'patientDashboard.nav.overview',
                            styles: { utilityClasses: navBtnActive },
                            click: { actionId: 'set-patient-dashboard-nav-overview' }
                          }
                        },
                        {
                          id: 'hospital-patient-dashboard-nav-overview-inactive',
                          type: 'button',
                          condition: patientDashNavInactive('overview'),
                          config: {
                            i18nKey: 'patientDashboard.nav.overview',
                            styles: { utilityClasses: navBtnInactive },
                            click: { actionId: 'set-patient-dashboard-nav-overview' }
                          }
                        },
                        {
                          id: 'hospital-patient-dashboard-nav-devices-active',
                          type: 'button',
                          condition: patientDashNavActive('devices'),
                          config: {
                            i18nKey: 'patientDashboard.nav.devices',
                            styles: { utilityClasses: navBtnActive },
                            click: {
                              actionId: 'set-patient-dashboard-nav-devices',
                              onSuccess: { actionId: 'init-patient-device-readings' }
                            }
                          }
                        },
                        {
                          id: 'hospital-patient-dashboard-nav-devices-inactive',
                          type: 'button',
                          condition: patientDashNavInactive('devices'),
                          config: {
                            i18nKey: 'patientDashboard.nav.devices',
                            styles: { utilityClasses: navBtnInactive },
                            click: {
                              actionId: 'set-patient-dashboard-nav-devices',
                              onSuccess: { actionId: 'init-patient-device-readings' }
                            }
                          }
                        }
                      ]
                    }
                  },
                  {
                    id: 'hospital-patient-dashboard-main',
                    type: 'container',
                    config: {
                      styles: {
                        utilityClasses:
                          'col-span-12 md:col-span-10 rounded-xl border border-slate-200 bg-white p-4 space-y-4'
                      },
                      children: [
                        {
                          id: 'hospital-patient-dashboard-panel-overview',
                          type: 'container',
                          condition: patientDashNavActive('overview'),
                          config: {
                            styles: { utilityClasses: 'flex flex-col gap-6' },
                            children: [
                              {
                                id: 'hospital-patient-dashboard-intro',
                                type: 'text',
                                config: {
                                  i18nKey: 'page.patientDashboard.title',
                                  styles: { styleTemplate: 'hosp.section.heading' }
                                }
                              },
                              {
                                id: 'hospital-patient-dashboard-next-steps',
                                type: 'container',
                                config: {
                                  layoutTemplate: 'hosp.section.stack',
                                  styles: { styleTemplate: 'hosp.section.card' },
                                  children: [
                                    {
                                      id: 'hospital-patient-dashboard-guidance',
                                      type: 'text',
                                      config: {
                                        i18nKey: 'page.patientDashboard.introGuidance',
                                        styles: { styleTemplate: 'hosp.section.subheading' }
                                      }
                                    },
                                    {
                                      id: 'hospital-patient-dashboard-highlights',
                                      type: 'list',
                                      config: {
                                        listStyleTemplate: 'hosp.highlights.grid',
                                        mapping: {
                                          packageName: 'hospital',
                                          key: 'HomeContent',
                                          property: 'highlights'
                                        },
                                        itemTemplate: {
                                          layoutTemplate: 'hosp.highlight.card',
                                          styles: { styleTemplate: 'hosp.highlight.card' },
                                          children: [
                                            {
                                              id: 'hospital-patient-dashboard-highlight-title',
                                              type: 'text',
                                              config: {
                                                text: '{{title}}',
                                                styles: { styleTemplate: 'hosp.highlight.title' }
                                              }
                                            },
                                            {
                                              id: 'hospital-patient-dashboard-highlight-detail',
                                              type: 'text',
                                              config: {
                                                text: '{{detail}}',
                                                styles: { styleTemplate: 'hosp.highlight.detail' }
                                              }
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  ]
                                }
                              }
                            ]
                          }
                        },
                        {
                          id: 'hospital-patient-dashboard-panel-devices',
                          type: 'container',
                          condition: patientDashNavActive('devices'),
                          config: {
                            styles: { utilityClasses: 'space-y-4' },
                            children: [
                              {
                                id: 'hospital-patient-dashboard-devices-title',
                                type: 'text',
                                config: {
                                  i18nKey: 'devices.title',
                                  styles: {
                                    styleTemplate: 'hosp.section.heading',
                                    utilityClasses: 'text-2xl'
                                  }
                                }
                              },
                              {
                                id: 'hospital-patient-dashboard-devices-intro',
                                type: 'text',
                                config: {
                                  i18nKey: 'devices.intro',
                                  styles: { styleTemplate: 'hosp.section.subheading' }
                                }
                              },
                              {
                                id: 'hospital-patient-dashboard-devices-ui',
                                type: 'bluetooth-devices',
                                config: {}
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter('hospital-patient-dashboard-footer', '', {
        taglineI18nKey: 'footer.tagline.patientDashboard'
      })
    ]
  }
};
