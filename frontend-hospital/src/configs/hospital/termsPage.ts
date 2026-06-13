import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';
import { legalIntroBlock, legalPageMain, legalSection } from './legalPageLayout';

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
      legalPageMain('hospital-terms', [
        legalIntroBlock(
          'hospital-terms',
          'legal.terms.hero',
          'legal.terms.subhero',
          'legal.terms.updatedBody'
        ),
        legalSection('hospital-terms-s1', 'legal.terms.s1Title', 'legal.terms.s1Body'),
        legalSection('hospital-terms-s2', 'legal.terms.s2Title', 'legal.terms.s2Body'),
        legalSection('hospital-terms-s2b', 'legal.terms.s2bTitle', 'legal.terms.s2bBody'),
        legalSection('hospital-terms-s3', 'legal.terms.s3Title', 'legal.terms.s3Body'),
        legalSection('hospital-terms-s4', 'legal.terms.s4Title', 'legal.terms.s4Body'),
        legalSection('hospital-terms-s5', 'legal.terms.s5Title', 'legal.terms.s5Body'),
        legalSection('hospital-terms-s6', 'legal.terms.s6Title', 'legal.terms.s6Body'),
        legalSection('hospital-terms-s7', 'legal.terms.s7Title', 'legal.terms.s7Body'),
        legalSection('hospital-terms-s8', 'legal.terms.s8Title', 'legal.terms.s8Body'),
        legalSection('hospital-terms-s9', 'legal.terms.s9Title', 'legal.terms.s9Body'),
        legalSection('hospital-terms-s10', 'legal.terms.s10Title', 'legal.terms.s10Body')
      ]),
      hospitalSiteFooter('hospital-terms-footer', '', {
        termsPageId: '',
        taglineI18nKey: 'footer.tagline.termsPage'
      })
    ]
  }
};
