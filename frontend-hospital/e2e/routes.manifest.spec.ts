import { hospitalRouteManifest } from './manifests/hospitalRoutes';
import { expectHospitalPageLoaded } from './support/assertions/page';
import { test } from './fixtures/base';

for (const route of hospitalRouteManifest) {
  test(`loads /page/${route.packageName}/${route.pageId}`, async ({ page }, testInfo) => {
    testInfo.skip(
      Boolean(route.skipRouteSmoke || route.skipHeavyIntegration),
      route.skipHeavyIntegration ? 'integration / realtime' : 'redirect or unstable URL'
    );
    await page.goto(`/page/${route.packageName}/${route.pageId}`);
    await expectHospitalPageLoaded(page, route.pageId, route.packageName);
  });
}
