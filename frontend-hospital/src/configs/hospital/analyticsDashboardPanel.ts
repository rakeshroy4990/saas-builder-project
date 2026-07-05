import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

export function analyticsPanelContentChildren(idPrefix: string): ComponentDefinition[] {
  return [
    {
      id: `${idPrefix}-ui`,
      type: 'analytics-workspace',
      config: {}
    }
  ];
}

const staffRoleMappings = {
  role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
} as const;

export const hospitalDashboardAnalyticsPanel: ComponentDefinition = {
  id: 'hospital-dashboard-panel-analytics',
  type: 'container',
  condition: {
    expression:
      "(String(role ?? '').toUpperCase() === 'ADMIN' || String(role ?? '').toUpperCase() === 'DOCTOR') && String(activeItem ?? '') === 'analytics'",
    mappings: {
      ...staffRoleMappings,
      activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
    }
  },
  config: {
    styles: { utilityClasses: 'space-y-4' },
    children: analyticsPanelContentChildren('hospital-dashboard-analytics')
  }
};

export function dashboardAnalyticsNavButtons(): ComponentDefinition[] {
  const activeClasses =
    'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm';
  const inactiveClasses =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50';
  const roleExpr =
    "(String(role ?? '').toUpperCase() === 'ADMIN' || String(role ?? '').toUpperCase() === 'DOCTOR')";
  const clickChain = {
    actionId: 'require-hospital-dashboard-session',
    data: { tab: 'analytics' },
    onSuccess: {
      actionId: 'set-dashboard-nav-analytics',
      onSuccess: {
        actionId: 'init-analytics-dashboard',
        onSuccess: { actionId: 'set-dashboard-header-active' }
      }
    }
  };
  return [
    {
      id: 'hospital-dashboard-menu-analytics-active',
      type: 'button',
      condition: {
        expression: `${roleExpr} && String(activeItem ?? '') === 'analytics'`,
        mappings: {
          ...staffRoleMappings,
          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
        }
      },
      config: {
        i18nKey: 'dashboard.nav.analytics',
        styles: { utilityClasses: activeClasses },
        click: clickChain
      }
    },
    {
      id: 'hospital-dashboard-menu-analytics-inactive',
      type: 'button',
      condition: {
        expression: `${roleExpr} && String(activeItem ?? '') !== 'analytics'`,
        mappings: {
          ...staffRoleMappings,
          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
        }
      },
      config: {
        i18nKey: 'dashboard.nav.analytics',
        styles: { utilityClasses: inactiveClasses },
        click: clickChain
      }
    }
  ];
}
