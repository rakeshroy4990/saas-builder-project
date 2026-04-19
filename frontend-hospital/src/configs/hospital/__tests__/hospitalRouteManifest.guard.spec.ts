import { describe, it, expect } from 'vitest';
import { hospitalRouteManifest } from '../../../../e2e/manifests/hospitalRoutes';
import { hospitalPages } from '../pages';

describe('hospitalRouteManifest', () => {
  it('lists every pageId from hospitalPages', () => {
    const manifestIds = new Set(hospitalRouteManifest.map((r) => r.pageId));
    const uniquePageIds = [...new Set(hospitalPages.map((p) => p.pageId))];
    const missing = uniquePageIds.filter((id) => !manifestIds.has(id));
    expect(missing, `Add to e2e/manifests/hospitalRoutes.ts: ${missing.join(', ')}`).toEqual([]);
  });
});
