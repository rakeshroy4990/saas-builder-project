import { expectPopupClosed, expectPopupOpen } from './support/assertions/popup';
import {
  headerLoginTrigger,
  loginPopupRegisterLink,
  loginPopupResetLink,
  popupPanel,
  registerPopupCancel
} from './support/selectors/hospitalUi';
import { test, expect } from './fixtures/base';

test.describe('auth popups from home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/page/hospital/home');
  });

  test('login → register → close', async ({ page }) => {
    await headerLoginTrigger(page).click();
    await expectPopupOpen(page);
    await expect(popupPanel(page)).toContainText('Login');

    await loginPopupRegisterLink(page).click();
    await expect(popupPanel(page)).toContainText('Register');

    await registerPopupCancel(page).click();
    await expectPopupClosed(page);
  });

  test('login → reset password → Escape closes', async ({ page }) => {
    await headerLoginTrigger(page).click();
    await expectPopupOpen(page);

    await loginPopupResetLink(page).click();
    await expect(popupPanel(page)).toContainText('Reset password');

    await page.keyboard.press('Escape');
    await expectPopupClosed(page);
  });
});
