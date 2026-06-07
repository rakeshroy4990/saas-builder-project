import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

function termsSection(id: string, titleKey: string, bodyKey: string): ComponentDefinition {
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

export const hospitalTermsPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'terms',
  title: 'Terms & Conditions',
  titleKey: 'page.terms.title',
  initializeActions: [{ actionId: 'set-home-header-active' }],
  container: {
    layoutTemplate: 'hosp.page.root',
    children: [
      ...hospitalPublicChromeTop,
      {
        id: 'hospital-terms-main',
        type: 'container',
        config: {
          styles: { utilityClasses: 'w-full flex-1 min-h-0 overflow-y-auto' },
          children: [
            {
              id: 'hospital-terms-inner',
              type: 'container',
              config: {
                layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-6'] },
                styles: { utilityClasses: 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6' },
                children: [
                  {
                    id: 'hospital-terms-intro',
                    type: 'container',
                    config: {
                      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-3'] },
                      styles: {
                        utilityClasses:
                          'w-full rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6'
                      },
                      children: [
                        {
                          id: 'hospital-terms-hero',
                          type: 'text',
                          config: {
                            i18nKey: 'legal.terms.hero',
                            styles: { utilityClasses: 'block w-full text-2xl sm:text-3xl font-bold text-slate-900' }
                          }
                        },
                        {
                          id: 'hospital-terms-subhero',
                          type: 'text',
                          config: {
                            i18nKey: 'legal.terms.subhero',
                            styles: { utilityClasses: 'block w-full text-base font-medium text-emerald-900/90' }
                          }
                        },
                        {
                          id: 'hospital-terms-updated-label',
                          type: 'text',
                          config: {
                            i18nKey: 'legal.terms.updatedLabel',
                            styles: {
                              utilityClasses:
                                'mt-2 block w-full text-xs font-semibold uppercase tracking-wide text-slate-500'
                            }
                          }
                        },
                        {
                          id: 'hospital-terms-updated-body',
                          type: 'text',
                          config: {
                            i18nKey: 'legal.terms.updatedBody',
                            styles: { utilityClasses: 'block w-full text-sm leading-relaxed text-slate-600' }
                          }
                        }
                      ]
                    }
                  },
                  termsSection('hospital-terms-s1', 'legal.terms.s1Title', 'legal.terms.s1Body'),
                  termsSection('hospital-terms-s2', 'legal.terms.s2Title', 'legal.terms.s2Body'),
                  termsSection('hospital-terms-s2b', 'legal.terms.s2bTitle', 'legal.terms.s2bBody'),
                  termsSection('hospital-terms-s3', 'legal.terms.s3Title', 'legal.terms.s3Body'),
                  termsSection('hospital-terms-s4', 'legal.terms.s4Title', 'legal.terms.s4Body'),
                  termsSection('hospital-terms-s5', 'legal.terms.s5Title', 'legal.terms.s5Body'),
                  termsSection('hospital-terms-s6', 'legal.terms.s6Title', 'legal.terms.s6Body'),
                  termsSection('hospital-terms-s7', 'legal.terms.s7Title', 'legal.terms.s7Body'),
                  termsSection('hospital-terms-s8', 'legal.terms.s8Title', 'legal.terms.s8Body'),
                  termsSection('hospital-terms-s9', 'legal.terms.s9Title', 'legal.terms.s9Body'),
                  termsSection('hospital-terms-s10', 'legal.terms.s10Title', 'legal.terms.s10Body')
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter('hospital-terms-footer', '', {
        termsPageId: '',
        taglineI18nKey: 'footer.tagline.termsPage'
      })
    ]
  }
};
