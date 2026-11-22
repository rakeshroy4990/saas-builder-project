# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> smoke >> home loads
- Location: e2e/smoke.spec.ts:5:3

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/page\/hospital\/home($|\?|#)/
Received string:  "http://127.0.0.1:4173/home"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    9 × unexpected value "http://127.0.0.1:4173/home"

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
      - generic [ref=e35]:
        - generic [ref=e36]: Your Health, Our Priority
        - generic [ref=e37]: Experience compassionate care with state-of-the-art medical facilities. Our team of expert physicians is dedicated to your wellbeing.
        - generic [ref=e38]:
          - button "Schedule Visit" [ref=e39]:
            - generic [ref=e41]: Schedule Visit
          - button "Growth Tracker" [ref=e42]:
            - generic [ref=e44]: Growth Tracker
      - generic [ref=e46]:
        - generic [ref=e47]: Meet Our Expert Doctors
        - generic [ref=e48]: Our team of highly qualified and experienced medical professionals
      - generic [ref=e49]:
        - generic [ref=e50]: Our Medical Services
        - generic [ref=e51]: Comprehensive healthcare services delivered with excellence and compassion
        - generic [ref=e53]:
          - img "image" [ref=e54]
          - generic [ref=e55]: Pediatrics
          - generic [ref=e56]: Gentle and comprehensive care for children of all ages
      - generic [ref=e57]:
        - generic [ref=e58]: Why Choose Agastya Healthcare?
        - generic [ref=e59]:
          - generic [ref=e60]:
            - generic [ref=e61]: Advanced Technology
            - generic [ref=e62]: Latest medical equipment and diagnostic tools
          - generic [ref=e63]:
            - generic [ref=e64]: Expert Medical Team
            - generic [ref=e65]: Board-certified physicians and specialists
          - generic [ref=e66]:
            - generic [ref=e67]: Patient-Centered Care
            - generic [ref=e68]: Personalized treatment plans for every patient
      - generic [ref=e69]:
        - generic [ref=e70]: Get In Touch
        - generic [ref=e71]: "WhatsApp Only: 6360895190"
        - generic [ref=e72]: "EmailId: pedsforpeople@gmail.com"
    - generic [ref=e73]:
      - text: Agastya Healthcare
      - generic [ref=e74]:
        - button "Terms & Conditions" [ref=e75]:
          - generic [ref=e77]: Terms & Conditions
        - button "Privacy Notice (India)" [ref=e78]:
          - generic [ref=e80]: Privacy Notice (India)
  - button "Open chat" [ref=e81]:
    - generic: AI
    - img [ref=e82]
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