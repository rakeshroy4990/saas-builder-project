import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

const FLOW_STEP_CLASSES =
  'w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm';
const FLOW_ARROW_CLASSES = 'block text-center text-lg font-bold text-emerald-600 leading-none py-0.5';
const STANDARD_BADGE_CLASSES =
  'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700 sm:text-sm';

function flowArrow(id: string): ComponentDefinition {
  return {
    id,
    type: 'text',
    config: {
      text: '↓',
      styles: { utilityClasses: FLOW_ARROW_CLASSES }
    }
  };
}

function flowStep(id: string, i18nKey: string, extraClasses = ''): ComponentDefinition {
  return {
    id,
    type: 'text',
    config: {
      i18nKey,
      styles: { utilityClasses: `${FLOW_STEP_CLASSES} ${extraClasses}`.trim() }
    }
  };
}

function standardBadge(id: string, i18nKey: string): ComponentDefinition {
  return {
    id,
    type: 'text',
    config: {
      i18nKey,
      styles: { utilityClasses: STANDARD_BADGE_CLASSES }
    }
  };
}

/**
 * Device integration architecture + recommended standards (shared by hospital and patient dashboards).
 */
export function devicesIntegrationDesignBlocks(idPrefix: string): ComponentDefinition[] {
  return [
    {
      id: `${idPrefix}-integration-architecture`,
      type: 'container',
      config: {
        styles: { styleTemplate: 'hosp.section.card', utilityClasses: 'space-y-4' },
        children: [
          {
            id: `${idPrefix}-integration-architecture-heading`,
            type: 'text',
            config: {
              i18nKey: 'devices.integration.architectureTitle',
              styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-xl' }
            }
          },
          {
            id: `${idPrefix}-integration-architecture-intro`,
            type: 'text',
            config: {
              i18nKey: 'devices.integration.architectureIntro',
              styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'text-sm' }
            }
          },
          {
            id: `${idPrefix}-integration-flow`,
            type: 'container',
            config: {
              styles: { utilityClasses: 'mx-auto flex w-full max-w-md flex-col items-stretch gap-0' },
              children: [
                flowStep(`${idPrefix}-flow-medical-device`, 'devices.integration.flow.medicalDevice'),
                flowArrow(`${idPrefix}-flow-arrow-1`),
                flowStep(`${idPrefix}-flow-device-adapter`, 'devices.integration.flow.deviceAdapter'),
                flowArrow(`${idPrefix}-flow-arrow-2`),
                flowStep(`${idPrefix}-flow-integration-service`, 'devices.integration.flow.integrationService'),
                flowArrow(`${idPrefix}-flow-arrow-3`),
                flowStep(`${idPrefix}-flow-fhir-hl7`, 'devices.integration.flow.fhirHl7'),
                flowArrow(`${idPrefix}-flow-arrow-4`),
                flowStep(
                  `${idPrefix}-flow-agastya`,
                  'devices.integration.flow.agastya',
                  'border-emerald-300 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
                )
              ]
            }
          }
        ]
      }
    },
    {
      id: `${idPrefix}-integration-standards`,
      type: 'container',
      config: {
        styles: { styleTemplate: 'hosp.section.card', utilityClasses: 'space-y-4' },
        children: [
          {
            id: `${idPrefix}-standards-heading`,
            type: 'text',
            config: {
              i18nKey: 'devices.integration.standardsTitle',
              styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-xl' }
            }
          },
          {
            id: `${idPrefix}-standards-intro`,
            type: 'text',
            config: {
              i18nKey: 'devices.integration.standardsIntro',
              styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'text-sm' }
            }
          },
          {
            id: `${idPrefix}-standards-grid`,
            type: 'container',
            config: {
              styles: { utilityClasses: 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5' },
              children: [
                standardBadge(`${idPrefix}-standard-hl7`, 'devices.integration.standards.hl7'),
                standardBadge(`${idPrefix}-standard-fhir`, 'devices.integration.standards.fhir'),
                standardBadge(`${idPrefix}-standard-dicom`, 'devices.integration.standards.dicom'),
                standardBadge(`${idPrefix}-standard-snomed`, 'devices.integration.standards.snomed'),
                standardBadge(`${idPrefix}-standard-loinc`, 'devices.integration.standards.loinc')
              ]
            }
          },
          {
            id: `${idPrefix}-fhir-standard-note`,
            type: 'container',
            config: {
              styles: { styleTemplate: 'hosp.highlight.card' },
              children: [
                {
                  id: `${idPrefix}-fhir-standard-note-text`,
                  type: 'text',
                  config: {
                    i18nKey: 'devices.integration.fhirInternalStandard',
                    styles: { styleTemplate: 'hosp.highlight.detail' }
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ];
}

/** Shared Devices panel body: title, intro, integration design, Bluetooth UI. */
export function devicesPanelContentChildren(idPrefix: string): ComponentDefinition[] {
  return [
    {
      id: `${idPrefix}-title`,
      type: 'text',
      config: {
        i18nKey: 'devices.title',
        styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-2xl' }
      }
    },
    {
      id: `${idPrefix}-intro`,
      type: 'text',
      config: {
        i18nKey: 'devices.intro',
        styles: { styleTemplate: 'hosp.section.subheading' }
      }
    },
    ...devicesIntegrationDesignBlocks(idPrefix),
    {
      id: `${idPrefix}-connect-heading`,
      type: 'text',
      config: {
        i18nKey: 'devices.connectTitle',
        styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-xl pt-2' }
      }
    },
    {
      id: `${idPrefix}-ui`,
      type: 'bluetooth-devices',
      config: {}
    }
  ];
}

/** Main dashboard panel when `DashboardNav.activeItem === 'devices'`. */
export const hospitalDashboardDevicesPanel: ComponentDefinition = {
  id: 'hospital-dashboard-panel-devices',
  type: 'container',
  condition: {
    expression: "String(activeItem ?? '') === 'devices'",
    mappings: {
      activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
    }
  },
  config: {
    styles: { utilityClasses: 'space-y-4' },
    children: devicesPanelContentChildren('hospital-dashboard-devices')
  }
};

/** Left menu active/inactive pair for Devices tab. */
export function dashboardDevicesNavButtons(): ComponentDefinition[] {
  const activeClasses =
    'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm';
  const inactiveClasses =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50';

  const clickChain = {
    actionId: 'require-hospital-dashboard-session',
    data: { tab: 'devices' },
    onSuccess: {
      actionId: 'set-dashboard-nav-devices',
      onSuccess: {
        actionId: 'init-patient-device-readings',
        onSuccess: { actionId: 'set-dashboard-header-active' }
      }
    }
  };

  return [
    {
      id: 'hospital-dashboard-menu-devices-active',
      type: 'button',
      condition: {
        expression: "String(activeItem ?? '') === 'devices'",
        mappings: {
          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
        }
      },
      config: {
        i18nKey: 'dashboard.nav.devices',
        styles: { utilityClasses: activeClasses },
        click: clickChain
      }
    },
    {
      id: 'hospital-dashboard-menu-devices-inactive',
      type: 'button',
      condition: {
        expression: "String(activeItem ?? '') !== 'devices'",
        mappings: {
          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
        }
      },
      config: {
        i18nKey: 'dashboard.nav.devices',
        styles: { utilityClasses: inactiveClasses },
        click: clickChain
      }
    }
  ];
}
