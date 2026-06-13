import type { ComponentDefinition } from '../../core/types/ComponentDefinition';

export function legalSection(id: string, titleKey: string, bodyKey: string): ComponentDefinition {
  return {
    id: `${id}-section`,
    type: 'container',
    config: {
      layoutTemplate: 'hosp.section.stack',
      styles: { styleTemplate: 'hosp.section.card', utilityClasses: 'scroll-mt-4' },
      children: [
        {
          id: `${id}-title`,
          type: 'text',
          config: {
            i18nKey: titleKey,
            styles: { utilityClasses: 'block w-full text-base font-semibold text-slate-900' }
          }
        },
        {
          id: `${id}-body`,
          type: 'text',
          config: {
            i18nKey: bodyKey,
            styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'text-sm leading-relaxed' }
          }
        }
      ]
    }
  };
}

export function legalIntroBlock(
  id: string,
  heroKey: string,
  subheroKey: string,
  updatedBodyKey: string
): ComponentDefinition {
  return {
    id: `${id}-intro`,
    type: 'container',
    config: {
      layoutTemplate: 'hosp.section.stack',
      styles: { styleTemplate: 'hosp.section.card' },
      children: [
        {
          id: `${id}-hero`,
          type: 'text',
          config: {
            i18nKey: heroKey,
            styles: { styleTemplate: 'hosp.section.heading' }
          }
        },
        {
          id: `${id}-subhero`,
          type: 'text',
          config: {
            i18nKey: subheroKey,
            styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'font-medium' }
          }
        },
        {
          id: `${id}-updated-body`,
          type: 'text',
          config: {
            i18nKey: updatedBodyKey,
            styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'text-sm leading-relaxed' }
          }
        }
      ]
    }
  };
}

export function legalPageMain(id: string, children: ComponentDefinition[]): ComponentDefinition {
  return {
    id: `${id}-main`,
    type: 'container',
    config: {
      styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col gap-6 max-w-6xl mx-auto' },
      children
    }
  };
}
