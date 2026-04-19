import { expectHospitalPageLoaded } from './support/assertions/page';
import { test } from './fixtures/base';

test.describe('smoke', () => {
  test('home loads', async ({ page }) => {
    await page.goto('/page/hospital/home');
    await expectHospitalPageLoaded(page, 'home');
  });

  test('terms loads', async ({ page }) => {
    await page.goto('/page/hospital/terms');
    await expectHospitalPageLoaded(page, 'terms');
  });
});
