import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

function privacySection(id: string, titleKey: string, bodyKey: string): ComponentDefinition {
  return {
    id: `${id}-section`,
    type: 'container',
    config: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-3'] },
      styles: {
        utilityClasses:
          'w-full rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm scroll-mt-4'
      },
      children: [
        {
          id: `${id}-title`,
          type: 'text',
          config: {
            i18nKey: titleKey,
            styles: { utilityClasses: 'block w-full text-base font-semibold text-slate-900' }
          }
        },
        {
          id: `${id}-body`,
          type: 'text',
          config: {
            i18nKey: bodyKey,
            styles: { utilityClasses: 'block w-full text-sm leading-relaxed text-slate-600' }
          }
        }
      ]
    }
  };
}

/**
 * Health-data privacy notice aligned with India’s Digital Personal Data Protection Act, 2023 (DPDP)
 * expectations for transparency. Have qualified counsel review before production use.
 */
export const hospitalPrivacyPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'privacy',
  title: 'Privacy Notice (India)',
  titleKey: 'page.privacy.title',
  initializeActions: [{ actionId: 'set-home-header-active' }],
  container: {
    layoutTemplate: 'hosp.page.root',
    children: [
      ...hospitalPublicChromeTop,
      {
        id: 'hospital-privacy-main',
        type: 'container',
        config: {
          styles: { utilityClasses: 'w-full flex-1 min-h-0 overflow-y-auto' },
          children: [
            {
              id: 'hospital-privacy-inner',
              type: 'container',
              config: {
                layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-6'] },
                styles: { utilityClasses: 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6' },
                children: [
                  {
                    id: 'hospital-privacy-intro',
                    type: 'container',
                    config: {
                      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-3'] },
                      styles: {
                        utilityClasses:
                          'w-full rounded-xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-6'
                      },
                      children: [
                        {
                          id: 'hospital-privacy-hero',
                          type: 'text',
                          config: {
                            i18nKey: 'legal.privacy.hero',
                            styles: { utilityClasses: 'block w-full text-2xl sm:text-3xl font-bold text-slate-900' }
                          }
                        },
                        {
                          id: 'hospital-privacy-subhero',
                          type: 'text',
                          config: {
                            i18nKey: 'legal.privacy.subhero',
                            styles: { utilityClasses: 'block w-full text-base font-medium text-indigo-900/90' }
                          }
                        },
                        {
                          id: 'hospital-privacy-updated-body',
                          type: 'text',
                          config: {
                            i18nKey: 'legal.privacy.updatedBody',
                            styles: { utilityClasses: 'block w-full text-sm leading-relaxed text-slate-600' }
                          }
                        }
                      ]
                    }
                  },
                  privacySection('hospital-privacy-s1', 'legal.privacy.s1Title', 'legal.privacy.s1Body'),
                  privacySection('hospital-privacy-s2', 'legal.privacy.s2Title', 'legal.privacy.s2Body'),
                  privacySection('hospital-privacy-s3', 'legal.privacy.s3Title', 'legal.privacy.s3Body'),
                  privacySection('hospital-privacy-s4', 'legal.privacy.s4Title', 'legal.privacy.s4Body'),
                  privacySection('hospital-privacy-s5', 'legal.privacy.s5Title', 'legal.privacy.s5Body'),
                  privacySection('hospital-privacy-s6', 'legal.privacy.s6Title', 'legal.privacy.s6Body'),
                  privacySection('hospital-privacy-s7', 'legal.privacy.s7Title', 'legal.privacy.s7Body'),
                  privacySection('hospital-privacy-s8', 'legal.privacy.s8Title', 'legal.privacy.s8Body'),
                  privacySection('hospital-privacy-s9', 'legal.privacy.s9Title', 'legal.privacy.s9Body'),
                  privacySection('hospital-privacy-s10', 'legal.privacy.s10Title', 'legal.privacy.s10Body')
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter('hospital-privacy-footer', '', {
        termsPageId: 'terms',
        privacyPageId: '',
        taglineI18nKey: 'footer.tagline.privacy'
      })
    ]
  }
};
