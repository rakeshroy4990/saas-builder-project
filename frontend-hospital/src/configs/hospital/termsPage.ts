import type { ComponentDefinition } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

/** One numbered clause as a card so titles and body stack (DynText uses inline spans). */
function termsSection(id: string, title: string, body: string): ComponentDefinition {
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

export const hospitalTermsPage: PageConfig = {
  packageName: 'hospital',
  pageId: 'terms',
  title: 'Terms & Conditions',
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
                            text: 'Terms & Conditions',
                            styles: { utilityClasses: 'block w-full text-2xl sm:text-3xl font-bold text-slate-900' }
                          }
                        },
                        {
                          id: 'hospital-terms-subhero',
                          type: 'text',
                          config: {
                            text: 'Online medical consultation for your baby',
                            styles: { utilityClasses: 'block w-full text-base font-medium text-emerald-900/90' }
                          }
                        },
                        {
                          id: 'hospital-terms-updated-label',
                          type: 'text',
                          config: {
                            text: 'Last updated',
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
                            text: 'These terms apply when you use Little Sprouts Care telehealth and online booking services for pediatric care.',
                            styles: { utilityClasses: 'block w-full text-sm leading-relaxed text-slate-600' }
                          }
                        }
                      ]
                    }
                  },
                  termsSection(
                    'hospital-terms-s1',
                    '1. Nature of the service',
                    'Little Sprouts Care offers online information, scheduling, and remote consultations related to pediatric and family health. Online sessions are not a substitute for an in-person examination when your clinician recommends one, and not all concerns can be assessed safely by video or chat.'
                  ),
                  termsSection(
                    'hospital-terms-s2',
                    '2. Not for emergencies',
                    'If your baby has trouble breathing, turns blue or gray, is unresponsive, has a seizure, severe bleeding, or any life-threatening symptom, call your local emergency number immediately. Do not use this site or online consultation to request emergency care.'
                  ),
                  termsSection(
                    'hospital-terms-s3',
                    '3. Parent or guardian',
                    'You must be a parent or legal guardian (or their authorized representative) to register a minor and to consent to care. You agree that information you provide about the child is accurate to the best of your knowledge.'
                  ),
                  termsSection(
                    'hospital-terms-s4',
                    '4. No guaranteed outcomes',
                    'Medical judgment depends on many factors. We do not guarantee specific results, diagnoses, or treatments from any online interaction. Your clinician may recommend in-person follow-up, tests, or referrals.'
                  ),
                  termsSection(
                    'hospital-terms-s5',
                    '5. Privacy and records',
                    'We use information you submit to provide care, operate appointments, and improve our services, consistent with applicable law and our internal policies. Video or chat sessions may be documented in the medical record where clinically appropriate.'
                  ),
                  termsSection(
                    'hospital-terms-s6',
                    '6. Telehealth limitations',
                    'Remote visits depend on your device, connection, and environment. Poor audio, video, or incomplete information may limit what we can advise. You agree to join from a private space when possible and not to record sessions without prior agreement where required by law.'
                  ),
                  termsSection(
                    'hospital-terms-s7',
                    '7. Account and acceptable use',
                    'You are responsible for safeguarding your login credentials. You will not misuse the platform, impersonate others, or upload harmful content. We may suspend access for violations or security concerns.'
                  ),
                  termsSection(
                    'hospital-terms-s8',
                    '8. Limitation of liability',
                    'To the fullest extent permitted by law, Little Sprouts Care and its staff are not liable for indirect or consequential damages arising from use of this website or online consultations. Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the maximum allowed by law.'
                  ),
                  termsSection(
                    'hospital-terms-s9',
                    '9. Changes',
                    'We may update these terms from time to time. Continued use after changes constitutes acceptance of the updated terms. The “Last updated” note above may be revised when we publish changes.'
                  ),
                  termsSection(
                    'hospital-terms-s10',
                    '10. Contact',
                    'For questions about these terms or your care, use the contact options shown on our website or ask your care team during your next visit.'
                  )
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter(
        'hospital-terms-footer',
        'Little Sprouts Care | Pediatric and family care you can trust.',
        { termsPageId: '' }
      )
    ]
  }
};
