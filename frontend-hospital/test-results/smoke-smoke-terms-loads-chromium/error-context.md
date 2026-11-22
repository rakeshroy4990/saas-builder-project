# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> smoke >> terms loads
- Location: e2e/smoke.spec.ts:10:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/page\/hospital\/terms($|\?|#)/
Received string:  "http://127.0.0.1:4173/terms"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    9 × unexpected value "http://127.0.0.1:4173/terms"

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e10]:
        - link "Agastya Healthcare logo" [ref=e11] [cursor=pointer]
        - link "Agastya Healthcare" [ref=e12] [cursor=pointer]
      - generic [ref=e13]:
        - button "Dashboard" [ref=e14]:
          - generic [ref=e16]: Dashboard
        - button "Prescriptions" [ref=e17]:
          - generic [ref=e19]: Prescriptions
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e23]:
            - generic [ref=e24]: Language
            - combobox "Select interface language" [ref=e25]:
              - option "English" [selected]
              - option "हिन्दी"
              - option "ಕನ್ನಡ"
          - button "Login/Register" [ref=e26]:
            - generic [ref=e28]: Login/Register
        - button "Book Now" [ref=e30]:
          - generic [ref=e32]: Book Now
    - generic [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]: Terms & Conditions
        - generic [ref=e36]: Online medical consultation for your baby
        - generic [ref=e37]: These terms apply when you use Agastya Healthcare telehealth and online booking services for pediatric care.
      - generic [ref=e38]:
        - generic [ref=e39]: 1. Nature of the service
        - generic [ref=e40]: Agastya Healthcare offers online information, scheduling, and remote consultations related to pediatric and family health. Online sessions are not a substitute for an in-person examination when your clinician recommends one, and not all concerns can be assessed safely by video or chat.
      - generic [ref=e41]:
        - generic [ref=e42]: 2. Not for emergencies
        - generic [ref=e43]: If your baby has trouble breathing, turns blue or gray, is unresponsive, has a seizure, severe bleeding, or any life-threatening symptom, call your local emergency number immediately. Do not use this site or online consultation to request emergency care.
      - generic [ref=e44]:
        - generic [ref=e45]: 2A. Smart AI assistant limitations
        - generic [ref=e46]: Our Smart AI chat provides general health guidance only and is not a doctor, diagnosis tool, or substitute for professional medical advice. Smart AI responses may be incomplete or unsuitable for your specific situation. You must seek a qualified clinician for diagnosis and treatment decisions, and you must use emergency services for urgent or life-threatening symptoms.
      - generic [ref=e47]:
        - generic [ref=e48]: 3. Parent or guardian
        - generic [ref=e49]: You must be a parent or legal guardian (or their authorized representative) to register a minor and to consent to care. You agree that information you provide about the child is accurate to the best of your knowledge.
      - generic [ref=e50]:
        - generic [ref=e51]: 4. No guaranteed outcomes
        - generic [ref=e52]: Medical judgment depends on many factors. We do not guarantee specific results, diagnoses, or treatments from any online interaction. Your clinician may recommend in-person follow-up, tests, or referrals.
      - generic [ref=e53]:
        - generic [ref=e54]: 5. Privacy and records
        - generic [ref=e55]: We use information you submit to provide care, operate appointments, and improve our services, consistent with applicable law and our internal policies. Video or chat sessions may be documented in the medical record where clinically appropriate.
      - generic [ref=e56]:
        - generic [ref=e57]: 6. Telehealth limitations
        - generic [ref=e58]: Remote visits depend on your device, connection, and environment. Poor audio, video, or incomplete information may limit what we can advise. You agree to join from a private space when possible and not to record sessions without prior agreement where required by law.
      - generic [ref=e59]:
        - generic [ref=e60]: 7. Account and acceptable use
        - generic [ref=e61]: You are responsible for safeguarding your login credentials. You will not misuse the platform, impersonate others, or upload harmful content. We may suspend access for violations or security concerns.
      - generic [ref=e62]:
        - generic [ref=e63]: 8. Limitation of liability
        - generic [ref=e64]: To the fullest extent permitted by law, Agastya Healthcare and its staff are not liable for indirect or consequential damages arising from use of this website or online consultations. Some jurisdictions do not allow certain limitations; in those cases, our liability is limited to the maximum allowed by law.
      - generic [ref=e65]:
        - generic [ref=e66]: 9. Changes
        - generic [ref=e67]: We may update these terms from time to time. Continued use after changes constitutes acceptance of the updated terms. The “Last updated” note above may be revised when we publish changes.
      - generic [ref=e68]:
        - generic [ref=e69]: 10. Contact
        - generic [ref=e70]: For questions about these terms or your care, use the contact options shown on our website or ask your care team during your next visit.
    - generic [ref=e71]:
      - text: Agastya Healthcare
      - button "Privacy Notice (India)" [ref=e73]:
        - generic [ref=e75]: Privacy Notice (India)
  - button "Open chat" [ref=e76]:
    - generic: AI
    - img [ref=e77]
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { expect } from '@playwright/test';
  3  | import { resolvePageRootDomId } from '../../../src/core/utils/domId';
  4  | 
  5  | export async function expectNoPageNotFound(page: Page): Promise<void> {
  6  |   await expect(page.locator('#system-page-not-found')).toHaveCount(0);
  7  | }
  8  | 
  9  | /** Full page shell under {@link DynamicPage} (not popup). */
  10 | export async function expectHospitalPageLoaded(page: Page, pageId: string, packageName = 'hospital'): Promise<void> {
  11 |   await expectNoPageNotFound(page);
  12 |   const rootId = resolvePageRootDomId({ packageName, pageId });
  13 |   await expect(page.locator(`#${rootId}-host`)).toBeVisible();
> 14 |   await expect(page).toHaveURL(new RegExp(`/page/${packageName}/${pageId}($|\\?|#)`));
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  15 | }
  16 | 
  17 | export async function expectNoFatalOverlay(page: Page): Promise<void> {
  18 |   await expect(page.locator('#system-page-not-found')).toHaveCount(0);
  19 | }
  20 | 
```