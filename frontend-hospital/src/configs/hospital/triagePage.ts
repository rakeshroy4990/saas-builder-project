import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

/** Full-page symptom triage wizard (patient-facing). */
export const hospitalTriagePage: PageConfig = {
  packageName: 'hospital',
  pageId: 'triage',
  title: 'Check symptoms',
  titleKey: 'page.triage.title',
  initializeActions: [{ actionId: 'set-home-header-active' }, { actionId: 'init-triage-page' }],
  container: {
    layoutTemplate: 'hosp.page.root',
    children: [
      ...hospitalPublicChromeTop,
      {
        id: 'hospital-triage-main',
        type: 'container',
        config: {
          styles: { utilityClasses: 'w-full flex-1 min-h-0 px-4 py-6 sm:px-6' },
          children: [
            {
              id: 'hospital-triage-inner',
              type: 'container',
              config: {
                styles: { utilityClasses: 'mx-auto w-full max-w-2xl' },
                children: [
                  {
                    id: 'hospital-triage-heading',
                    type: 'text',
                    config: {
                      i18nKey: 'page.triage.title',
                      styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'mb-2' }
                    }
                  },
                  {
                    id: 'hospital-triage-intro',
                    type: 'text',
                    config: {
                      i18nKey: 'triage.disclaimer',
                      styles: {
                        styleTemplate: 'hosp.section.subheading',
                        utilityClasses: 'mb-6 text-sm leading-relaxed'
                      }
                    }
                  },
                  {
                    id: 'hospital-triage-card',
                    type: 'container',
                    config: {
                      styles: { styleTemplate: 'hosp.section.card', utilityClasses: 'w-full' },
                      children: [
                        {
                          id: 'hospital-triage-wizard',
                          type: 'triage-wizard',
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
      },
      hospitalSiteFooter('hospital-triage-footer', '', {
        taglineI18nKey: 'footer.tagline.home'
      })
    ]
  }
};
