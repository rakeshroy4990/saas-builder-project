import { expect, test } from './fixtures/base';

test.describe('locale', () => {
  test('language switcher shows Hindi nav and persists after reload', async ({ page }) => {
    await page.goto('/home');
    const select = page.getByTestId('app-language-select');
    await expect(select).toBeVisible();
    await select.selectOption('hi');
    await expect(page.getByRole('button', { name: 'होम' }).first()).toBeVisible();
    await page.reload();
    await expect(select).toHaveValue('hi');
    await expect(page.getByRole('button', { name: 'होम' }).first()).toBeVisible();
  });

  test('/locale/hi shortcut applies Hindi', async ({ page }) => {
    await page.goto('/locale/hi');
    await page.waitForURL('**/home');
    await expect(page.getByTestId('app-language-select')).toHaveValue('hi');
  });
});
