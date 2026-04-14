import type { ComponentDefinition } from '../../../core/types/ComponentDefinition';

/**
 * Marketing hero block (badge, title, subtitle, image). Use inside any page’s main outlet
 * or standalone — does not include header/menu/footer.
 */
export const createHeroLayer = (idPrefix: string, label?: string): ComponentDefinition => {
  const heroCard: ComponentDefinition = {
    id: `${idPrefix}-hero-section`,
    type: 'container',
    config: {
      styles: { styleTemplate: 'ecom.hero.card.surface' },
      layoutTemplate: 'ecom.hero.card',
      children: [
        {
          id: `${idPrefix}-hero-copy-wrap`,
          type: 'container',
          config: {
            layoutTemplate: 'ecom.hero.copy',
            children: [
              {
                id: `${idPrefix}-hero-badge`,
                type: 'text',
                config: {
                  mapping: { packageName: 'ecommerce', key: 'HomeContent', path: 'hero', property: 'badge' },
                  styles: { styleTemplate: 'ecom.hero.badge' }
                }
              },
              {
                id: `${idPrefix}-hero-title`,
                type: 'text',
                config: {
                  mapping: { packageName: 'ecommerce', key: 'HomeContent', path: 'hero', property: 'title' },
                  styles: { styleTemplate: 'ecom.hero.title' }
                }
              },
              {
                id: `${idPrefix}-hero-subtitle`,
                type: 'text',
                config: {
                  mapping: { packageName: 'ecommerce', key: 'HomeContent', path: 'hero', property: 'subtitle' },
                  styles: { styleTemplate: 'ecom.hero.subtitle' }
                }
              }
            ]
          }
        },
        {
          id: `${idPrefix}-hero-image`,
          type: 'image',
          config: {
            src: '{{image}}',
            styles: { styleTemplate: 'ecom.hero.image' },
            mapping: { packageName: 'ecommerce', key: 'HomeContent', path: 'hero', property: 'image' }
          }
        }
      ]
    }
  };

  const children: ComponentDefinition[] = label
    ? [
        {
          id: `${idPrefix}-hero-label`,
          type: 'text',
          config: {
            text: label,
            styles: { styleTemplate: 'ecom.hero.sectionLabel' }
          }
        },
        heroCard
      ]
    : [heroCard];

  return {
    id: `${idPrefix}-hero-section-wrapper`,
    type: 'container',
    config: {
      layoutTemplate: label ? 'ecom.hero.wrapper' : 'ecom.hero.wrapper.compact',
      children
    }
  };
};
