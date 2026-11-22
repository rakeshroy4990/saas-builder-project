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
    'w-full rounded-full bg-brand-600 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-sm shadow-brand-900/10';
  const inactiveClasses =
    'w-full rounded-full px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-800';
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
