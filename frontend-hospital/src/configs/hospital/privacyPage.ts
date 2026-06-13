import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';
import { legalIntroBlock, legalPageMain, legalSection } from './legalPageLayout';

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
      legalPageMain('hospital-privacy', [
        legalIntroBlock(
          'hospital-privacy',
          'legal.privacy.hero',
          'legal.privacy.subhero',
          'legal.privacy.updatedBody'
        ),
        legalSection('hospital-privacy-s1', 'legal.privacy.s1Title', 'legal.privacy.s1Body'),
        legalSection('hospital-privacy-s2', 'legal.privacy.s2Title', 'legal.privacy.s2Body'),
        legalSection('hospital-privacy-s3', 'legal.privacy.s3Title', 'legal.privacy.s3Body'),
        legalSection('hospital-privacy-s4', 'legal.privacy.s4Title', 'legal.privacy.s4Body'),
        legalSection('hospital-privacy-s5', 'legal.privacy.s5Title', 'legal.privacy.s5Body'),
        legalSection('hospital-privacy-s6', 'legal.privacy.s6Title', 'legal.privacy.s6Body'),
        legalSection('hospital-privacy-s7', 'legal.privacy.s7Title', 'legal.privacy.s7Body'),
        legalSection('hospital-privacy-s8', 'legal.privacy.s8Title', 'legal.privacy.s8Body'),
        legalSection('hospital-privacy-s9', 'legal.privacy.s9Title', 'legal.privacy.s9Body'),
        legalSection('hospital-privacy-s10', 'legal.privacy.s10Title', 'legal.privacy.s10Body')
      ]),
      hospitalSiteFooter('hospital-privacy-footer', '', {
        termsPageId: 'terms',
        privacyPageId: '',
        taglineI18nKey: 'footer.tagline.privacy'
      })
    ]
  }
};
