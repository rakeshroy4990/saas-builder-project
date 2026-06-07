import { LOCALE_CONFIG, SUPPORTED_LOCALES } from '@saas-builder/i18n-contract';
import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

/** Locale picker buttons for the first-login onboarding popup. */
export function buildLocaleOnboardingButtons(): ComponentDefinition[] {
  return SUPPORTED_LOCALES.map((code, index) => ({
    id: `hospital-locale-onboarding-${code}`,
    type: 'button' as const,
    config: {
      text: LOCALE_CONFIG[code].label,
      styles: {
        styleTemplate: index === 0 ? 'hosp.popup.button.primary' : 'hosp.popup.button.secondary',
        utilityClasses: 'w-full sm:flex-1 min-h-[48px] text-base'
      },
      click: {
        actionId: 'save-preferred-locale',
        data: { locale: code },
        onSuccess: {
          actionType: 'closePopup',
          onSuccess: { actionId: 'run-dashboard-init-if-present' }
        }
      }
    }
  }));
}
