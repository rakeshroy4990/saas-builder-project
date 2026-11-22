import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

export function growthPanelContentChildren(idPrefix: string): ComponentDefinition[] {
  return [
    {
      id: `${idPrefix}-ui`,
      type: 'growth-workspace',
      config: {}
    }
  ];
}

const patientRoleMappings = {
  role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
} as const;

/** Main dashboard panel when `DashboardNav.activeItem === 'growth'` (patients). */
export const hospitalDashboardGrowthPanel: ComponentDefinition = {
  id: 'hospital-dashboard-panel-growth',
  type: 'container',
  condition: {
    expression: "String(role ?? '').toUpperCase() === 'PATIENT' && String(activeItem ?? '') === 'growth'",
    mappings: {
      ...patientRoleMappings,
      activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
    }
  },
  config: {
    styles: { utilityClasses: 'space-y-4' },
    children: growthPanelContentChildren('hospital-dashboard-growth')
  }
};

/** Left menu active/inactive pair for Growth tab on main dashboard (patients only). */
export function dashboardGrowthNavButtons(): ComponentDefinition[] {
  const activeClasses =
    'w-full rounded-full bg-brand-600 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-sm shadow-brand-900/10';
  const inactiveClasses =
    'w-full rounded-full px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-800';

  const clickChain = {
    actionId: 'require-hospital-dashboard-session',
    data: { tab: 'growth' },
    onSuccess: {
      actionId: 'set-dashboard-nav-growth',
      onSuccess: {
        actionId: 'init-growth-workspace',
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
      id: 'hospital-dashboard-menu-growth-active',
      type: 'button',
      condition: patientOnly("String(activeItem ?? '') === 'growth'"),
      config: {
        i18nKey: 'dashboard.nav.growth',
        styles: { utilityClasses: activeClasses },
        click: clickChain
      }
    },
    {
      id: 'hospital-dashboard-menu-growth-inactive',
      type: 'button',
      condition: patientOnly("String(activeItem ?? '') !== 'growth'"),
      config: {
        i18nKey: 'dashboard.nav.growth',
        styles: { utilityClasses: inactiveClasses },
        click: clickChain
      }
    }
  ];
}
