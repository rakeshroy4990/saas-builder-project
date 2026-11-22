import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

const doctorRoleMappings = {
  role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
} as const;

const doctorOnly = (activeItemExpr: string) => ({
  expression: `String(role ?? '').toUpperCase() === 'DOCTOR' && ${activeItemExpr}`,
  mappings: {
    ...doctorRoleMappings,
    activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
  }
});

function navClickChain(tab: string) {
  const navAction =
    tab === 'validate-prescription'
      ? 'set-dashboard-nav-validate-prescription'
      : 'set-dashboard-nav-recommended-dosage';
  return {
    actionId: 'require-hospital-dashboard-session',
    data: { tab },
    onSuccess: {
      actionId: navAction,
      onSuccess: { actionId: 'set-dashboard-header-active' }
    }
  };
}

function dashboardNavButtons(tab: string, i18nKey: string): ComponentDefinition[] {
  const activeClasses =
    'w-full rounded-full bg-brand-600 px-4 py-2.5 text-left text-sm font-semibold text-white shadow-sm shadow-brand-900/10';
  const inactiveClasses =
    'w-full rounded-full px-4 py-2.5 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-800';

  return [
    {
      id: `hospital-dashboard-menu-${tab}-active`,
      type: 'button',
      condition: doctorOnly(`String(activeItem ?? '') === '${tab}'`),
      config: {
        i18nKey,
        styles: { utilityClasses: activeClasses },
        click: navClickChain(tab)
      }
    },
    {
      id: `hospital-dashboard-menu-${tab}-inactive`,
      type: 'button',
      condition: doctorOnly(`String(activeItem ?? '') !== '${tab}'`),
      config: {
        i18nKey,
        styles: { utilityClasses: inactiveClasses },
        click: navClickChain(tab)
      }
    }
  ];
}

export function dashboardValidatePrescriptionNavButtons(): ComponentDefinition[] {
  return dashboardNavButtons('validate-prescription', 'dashboard.nav.validatePrescription');
}

export function dashboardRecommendedDosageNavButtons(): ComponentDefinition[] {
  return dashboardNavButtons('recommended-dosage', 'dashboard.nav.recommendedDosage');
}

export const hospitalDashboardValidatePrescriptionPanel: ComponentDefinition = {
  id: 'hospital-dashboard-panel-validate-prescription',
  type: 'container',
  condition: doctorOnly("String(activeItem ?? '') === 'validate-prescription'"),
  config: {
    styles: { utilityClasses: 'mx-auto w-full max-w-3xl space-y-4' },
    children: [
      {
        id: 'hospital-dashboard-validate-prescription-title',
        type: 'text',
        config: {
          i18nKey: 'dashboard.validatePrescription.title',
          styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-2xl' }
        }
      },
      {
        id: 'hospital-dashboard-validate-prescription-intro',
        type: 'text',
        config: {
          i18nKey: 'dashboard.validatePrescription.intro',
          styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'text-sm leading-relaxed' }
        }
      },
      {
        id: 'hospital-dashboard-validate-prescription-panel',
        type: 'doctor-validate-prescription',
        config: {}
      }
    ]
  }
};

export const hospitalDashboardRecommendedDosagePanel: ComponentDefinition = {
  id: 'hospital-dashboard-panel-recommended-dosage',
  type: 'container',
  condition: doctorOnly("String(activeItem ?? '') === 'recommended-dosage'"),
  config: {
    styles: { utilityClasses: 'mx-auto w-full max-w-3xl space-y-4' },
    children: [
      {
        id: 'hospital-dashboard-recommended-dosage-title',
        type: 'text',
        config: {
          i18nKey: 'dashboard.recommendedDosage.title',
          styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-2xl' }
        }
      },
      {
        id: 'hospital-dashboard-recommended-dosage-intro',
        type: 'text',
        config: {
          i18nKey: 'dashboard.recommendedDosage.intro',
          styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'text-sm leading-relaxed' }
        }
      },
      {
        id: 'hospital-dashboard-recommended-dosage-panel',
        type: 'doctor-recommended-dosage',
        config: {}
      }
    ]
  }
};
