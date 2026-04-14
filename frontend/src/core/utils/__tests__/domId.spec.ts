import { describe, expect, it } from 'vitest';
import { resolveComponentDomId, resolvePageRootDomId } from '../domId';

describe('resolveComponentDomId', () => {
  it('uses domId override when set', () => {
    expect(
      resolveComponentDomId({
        definitionId: 'child',
        type: 'text',
        idScope: 'page-root',
        domId: 'server-picked-id'
      })
    ).toBe('server-picked-id');
  });

  it('scopes by idScope when domId omitted', () => {
    expect(
      resolveComponentDomId({
        definitionId: 'child',
        type: 'text',
        idScope: 'page-root'
      })
    ).toBe('page-root--child');
  });

  it('uses bare definition id without scope when domId omitted', () => {
    expect(resolveComponentDomId({ definitionId: 'title', type: 'text' })).toBe('title');
  });
});

describe('resolvePageRootDomId', () => {
  it('prefers page domId over container', () => {
    expect(
      resolvePageRootDomId({
        packageName: 'hospital',
        pageId: 'x',
        pageDomId: 'page-override',
        containerDomId: 'container-override'
      })
    ).toBe('page-override');
  });

  it('uses container domId when page unset', () => {
    expect(
      resolvePageRootDomId({
        packageName: 'hospital',
        pageId: 'book-appointment',
        containerDomId: 'hospital-book-appointment-root'
      })
    ).toBe('hospital-book-appointment-root');
  });

  it('falls back to default id', () => {
    expect(
      resolvePageRootDomId({
        packageName: 'social',
        pageId: 'feed'
      })
    ).toBe('social-feed-page');
  });
});
