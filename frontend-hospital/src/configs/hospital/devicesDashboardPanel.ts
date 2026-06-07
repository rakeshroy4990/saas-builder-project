import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

/** Shared Devices panel body: title, intro, Bluetooth connect UI. */
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
