import { describe, expect, it } from 'vitest';
import type { PageConfig } from '../../types/PageConfig';
import { mergePageWithServerPatch } from '../mergeServerUiMetadata';

const samplePage: PageConfig = {
  packageName: 'social',
  pageId: 'feed',
  title: 'Social Feed',
  container: {
    layoutTemplate: 'flexshell.page.stack',
    children: [
      { id: 'social-feed-page-heading', type: 'text', config: { text: 'Feed' } },
      {
        id: 'social-feed-posts-list',
        type: 'list',
        config: {
          mapping: { packageName: 'social', key: 'Feed', property: 'posts' },
          itemTemplate: {
            layoutTemplate: 'social.post.card',
            children: [{ id: 'social-feed-post-body', type: 'text', config: { text: 'Post' } }]
          }
        }
      }
    ]
  }
};

describe('mergePageWithServerPatch', () => {
  it('preserves tree when server sends only root container domId', () => {
    const merged = mergePageWithServerPatch(samplePage, {
      container: { domId: 'server-root' }
    });
    expect(merged.container.domId).toBe('server-root');
    expect(merged.container.children).toHaveLength(2);
    expect(merged.container.children[1].id).toBe('social-feed-posts-list');
    expect(merged.container.children[1].domId).toBeUndefined();
  });

  it('merges domId on a child matched by id', () => {
    const merged = mergePageWithServerPatch(samplePage, {
      container: {
        children: [{ id: 'social-feed-posts-list', domId: 'posts-from-server' }]
      }
    });
    const list = merged.container.children.find((c) => c.id === 'social-feed-posts-list');
    expect(list?.domId).toBe('posts-from-server');
    expect(list?.config?.mapping).toEqual({ packageName: 'social', key: 'Feed', property: 'posts' });
  });

  it('merges list itemTemplate by id when server sends partial itemTemplate', () => {
    const merged = mergePageWithServerPatch(samplePage, {
      container: {
        children: [
          {
            id: 'social-feed-posts-list',
            config: {
              itemTemplate: {
                children: [{ id: 'social-feed-post-body', domId: 'post-body-server' }]
              }
            }
          }
        ]
      }
    });
    const list = merged.container.children.find((c) => c.id === 'social-feed-posts-list');
    const body = (list?.config?.itemTemplate as { children: { id: string; domId?: string }[] }).children[0];
    expect(body.domId).toBe('post-body-server');
    expect(body.config).toEqual({ text: 'Post' });
  });
});
