import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

function privacySection(id: string, title: string, body: string): ComponentDefinition {
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
            text: title,
            styles: { utilityClasses: 'block w-full text-base font-semibold text-slate-900' }
          }
        },
        {
          id: `${id}-body`,
          type: 'text',
          config: {
            text: body,
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
                            text: 'Privacy Notice — personal and health data',
                            styles: { utilityClasses: 'block w-full text-2xl sm:text-3xl font-bold text-slate-900' }
                          }
                        },
                        {
                          id: 'hospital-privacy-subhero',
                          type: 'text',
                          config: {
                            text: 'How we handle your information when you use Agastya Healthcare telehealth services',
                            styles: { utilityClasses: 'block w-full text-base font-medium text-indigo-900/90' }
                          }
                        },
                        {
                          id: 'hospital-privacy-updated-body',
                          type: 'text',
                          config: {
                            text: 'This notice supplements our Terms & Conditions. It is designed to meet transparency expectations under India’s Digital Personal Data Protection Act, 2023 (DPDP) for digital personal data. It is not legal advice; engage qualified counsel to finalize wording for your deployment.',
                            styles: { utilityClasses: 'block w-full text-sm leading-relaxed text-slate-600' }
                          }
                        }
                      ]
                    }
                  },
                  privacySection(
                    'hospital-privacy-s1',
                    '1. Who we are',
                    'Agastya Healthcare operates this website and telehealth services. For DPDP purposes, we act as a data fiduciary for personal data processed through this platform, subject to our agreements with you and applicable law.'
                  ),
                  privacySection(
                    'hospital-privacy-s2',
                    '2. What we collect',
                    'We collect identifiers and contact details you provide (such as name, email, phone), account credentials, appointment and clinical context needed for care (including child health information you share), session and support metadata, and technical data needed to run video consultations and secure the service (for example device/browser signals and security logs).'
                  ),
                  privacySection(
                    'hospital-privacy-s3',
                    '3. Why we use personal data',
                    'We use personal data to provide telehealth consultations and scheduling, authenticate users, deliver prescriptions and care documentation where applicable, send operational communications, improve reliability and safety of the service, comply with law, and respond to support requests. We do not sell your personal data.'
                  ),
                  privacySection(
                    'hospital-privacy-s4',
                    '4. Lawful basis and consent',
                    'Where DPDP or other law requires consent for specific processing, we will ask for it clearly (for example at registration or before optional features). You may withdraw consent where processing is consent-based, subject to legal or clinical record-keeping obligations.'
                  ),
                  privacySection(
                    'hospital-privacy-s5',
                    '5. Health information',
                    'Health-related information you share during consultations may be sensitive. We protect it with access controls, encryption in transit (HTTPS/TLS), and additional safeguards described in our security practices. Retention follows clinical, legal, and operational requirements.'
                  ),
                  privacySection(
                    'hospital-privacy-s6',
                    '6. Sharing',
                    'We share personal data with service providers who help us operate the platform (such as hosting, email, or video infrastructure) under contracts that require protection of your information. We may disclose information if required by law or to protect rights, safety, and security.'
                  ),
                  privacySection(
                    'hospital-privacy-s7',
                    '7. Your rights (India)',
                    'Subject to applicable law, you may request access, correction, or erasure of your personal data; receive information about processing; nominate a representative; and seek grievance redressal. We will respond within timelines prescribed by law where applicable. For grievances, use the contact channel published on this site.'
                  ),
                  privacySection(
                    'hospital-privacy-s8',
                    '8. Cross-border transfers',
                    'If personal data is transferred outside India, we do so in line with DPDP requirements (including permitted territories or appropriate safeguards as prescribed).'
                  ),
                  privacySection(
                    'hospital-privacy-s9',
                    '9. Children',
                    'Our pediatric services are directed at parents and guardians. Do not provide information about a child unless you have authority to do so.'
                  ),
                  privacySection(
                    'hospital-privacy-s10',
                    '10. Changes',
                    'We may update this notice to reflect legal, technical, or service changes. Material updates will be highlighted where appropriate. Continued use after updates constitutes notice of the revised policy where permitted by law.'
                  )
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter('hospital-privacy-footer', 'Agastya Healthcare | Pediatric and family care you can trust.', {
        termsPageId: 'terms',
        privacyPageId: ''
      })
    ]
  }
};
