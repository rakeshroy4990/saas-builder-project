import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

export function triagePanelContentChildren(idPrefix: string): ComponentDefinition[] {
  return [
    {
      id: `${idPrefix}-title`,
      type: 'text',
      config: {
        i18nKey: 'page.triage.title',
        styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-2xl' }
      }
    },
    {
      id: `${idPrefix}-intro`,
      type: 'text',
      config: {
        i18nKey: 'triage.disclaimer',
        styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'text-sm leading-relaxed' }
      }
    },
    {
      id: `${idPrefix}-wizard`,
      type: 'triage-wizard',
      config: {}
    }
  ];
}

const patientRoleMappings = {
  role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
} as const;

/** Main dashboard panel when `DashboardNav.activeItem === 'triage'` (patients). */
export const hospitalDashboardTriagePanel: ComponentDefinition = {
  id: 'hospital-dashboard-panel-triage',
  type: 'container',
  condition: {
    expression: "String(role ?? '').toUpperCase() === 'PATIENT' && String(activeItem ?? '') === 'triage'",
    mappings: {
      ...patientRoleMappings,
      activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
    }
  },
  config: {
    styles: { utilityClasses: 'mx-auto w-full max-w-2xl space-y-4' },
    children: triagePanelContentChildren('hospital-dashboard-triage')
  }
};

/** Left menu active/inactive pair for Check symptoms tab (patients only). */
export function dashboardTriageNavButtons(): ComponentDefinition[] {
  const activeClasses =
    'w-full rounded-full bg-brand-600 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-sm shadow-brand-900/10';
  const inactiveClasses =
    'w-full rounded-full px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-800';

  const clickChain = {
    actionId: 'require-hospital-dashboard-session',
    data: { tab: 'triage' },
    onSuccess: {
      actionId: 'set-dashboard-nav-triage',
      onSuccess: {
        actionId: 'init-triage-page',
        onSuccess: { actionId: 'set-dashboard-header-active' }
      }
    }
  };

  const patientOnly = (activeItemExpr: string) => ({
    expression: `String(role ?? '').toUpperCase() === 'PATIENT' && ${activeItemExpr}`,
    mappings: {
      ...patientRoleMappings,
      activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
    }
  });

  return [
    {
      id: 'hospital-dashboard-menu-triage-active',
      type: 'button',
      condition: patientOnly("String(activeItem ?? '') === 'triage'"),
      config: {
        i18nKey: 'dashboard.nav.triage',
        styles: { utilityClasses: activeClasses },
        click: clickChain
      }
    },
    {
      id: 'hospital-dashboard-menu-triage-inactive',
      type: 'button',
      condition: patientOnly("String(activeItem ?? '') !== 'triage'"),
      config: {
        i18nKey: 'dashboard.nav.triage',
        styles: { utilityClasses: inactiveClasses },
        click: clickChain
      }
    }
  ];
}
