import type { ComponentDefinition } from '../../../core/types/ComponentDefinition';

/** Horizontal category/menu strip driven by store data. */
export const createMenuLayer = (idPrefix: string, label?: string): ComponentDefinition => {
  const menuList: ComponentDefinition = {
    id: `${idPrefix}-menu-list`,
    type: 'list',
    config: {
      mapping: { packageName: 'ecommerce', key: 'HomeContent', property: 'menu' },
      listStyleTemplate: 'ecom.menu.list',
      itemTemplate: {
        layoutTemplate: 'ecom.menu.item.row',
        children: [
          {
            id: `${idPrefix}-menu-item`,
            type: 'text',
            config: {
              text: '{{label}}',
              styles: { styleTemplate: 'ecom.menu.itemText' }
            }
          }
        ]
      }
    }
  };

  const children: ComponentDefinition[] = label
    ? [
        {
          id: `${idPrefix}-menu-label`,
          type: 'text',
          config: {
            text: label,
            styles: { styleTemplate: 'ecom.menu.sectionLabel' }
          }
        },
        menuList
      ]
    : [menuList];

  return {
    id: `${idPrefix}-menu-section`,
    type: 'container',
    config: {
      layoutTemplate: label ? 'ecom.menu.section' : 'ecom.menu.section.compact',
      children
    }
  };
};
