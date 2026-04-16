import type { PageConfig } from '../../core/types/PageConfig';

export const socialPages: PageConfig[] = [
  {
    packageName: 'social',
    pageId: 'feed',
    title: 'Social Feed',
    initializeActions: [{ actionId: 'load-feed' }],
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
              children: [
                {
                  id: 'social-feed-post-body',
                  type: 'text',
                  config: { text: 'Post' }
                }
              ]
            }
          }
        }
      ]
    }
  },
  {
    packageName: 'social',
    pageId: 'profile',
    title: 'Profile',
    container: {
      layoutTemplate: 'flexshell.page.column',
      children: [
        {
          id: 'social-profile-intro',
          type: 'text',
          config: { text: 'Profile page' }
        }
      ]
    }
  },
  {
    packageName: 'social',
    pageId: 'messages',
    title: 'Messages',
    container: {
      layoutTemplate: 'flexshell.page.column',
      children: [
        {
          id: 'social-messages-intro',
          type: 'text',
          config: { text: 'Messages page' }
        }
      ]
    }
  }
];
