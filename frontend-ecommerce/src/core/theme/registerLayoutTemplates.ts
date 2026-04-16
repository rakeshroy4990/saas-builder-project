import { LayoutTemplateRegistry } from '../registry/LayoutTemplateRegistry';

export function registerLayoutTemplates(): void {
  LayoutTemplateRegistry.register('flexshell.page.stack', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'gap-4', 'p-6']
  });
  LayoutTemplateRegistry.register('flexshell.page.column', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'p-6']
  });

  LayoutTemplateRegistry.register('social.post.card', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'border', 'rounded', 'p-3']
  });

  LayoutTemplateRegistry.register('ecom.header.section', {
    type: 'flex',
    flex: ['flex-col', 'gap-4']
  });

  LayoutTemplateRegistry.register('ecom.header.card', {
    type: 'flex',
    flex: [
      'flex',
      'flex-col',
      'gap-4',
      'rounded-2xl',
      'bg-white',
      'px-4',
      'py-3',
      'sm:px-5',
      'sm:gap-3',
      'lg:flex-row',
      'lg:flex-wrap',
      'lg:items-center',
      'lg:justify-between'
    ]
  });

  LayoutTemplateRegistry.register('ecom.header.brand.row', {
    type: 'flex',
    flex: ['flex', 'min-w-0', 'shrink-0', 'items-center', 'gap-2', 'sm:gap-3']
  });

  LayoutTemplateRegistry.register('ecom.header.nav.row', {
    type: 'flex',
    flex: [
      'flex',
      'w-full',
      'min-w-0',
      'flex-wrap',
      'items-center',
      'gap-2',
      'lg:w-auto',
      'lg:shrink-0',
      '-mx-1',
      'px-1',
      'overflow-x-auto',
      'lg:overflow-visible'
    ]
  });

  LayoutTemplateRegistry.register('ecom.header.actions.row', {
    type: 'flex',
    flex: [
      'flex',
      'w-full',
      'min-w-0',
      'flex-wrap',
      'items-center',
      'gap-2',
      'sm:justify-end',
      'lg:w-auto',
      'lg:flex-nowrap',
      'lg:justify-end'
    ]
  });

  LayoutTemplateRegistry.register('ecom.header.search.wrap', {
    type: 'flex',
    flex: [
      'flex',
      'min-w-0',
      'flex-1',
      'items-center',
      'gap-2',
      'rounded-full',
      'border',
      'border-slate-200',
      'bg-slate-50',
      'px-3',
      'py-1.5',
      'sm:max-w-xs',
      'md:max-w-sm',
      'lg:flex-initial',
      'lg:w-56'
    ]
  });

  LayoutTemplateRegistry.register('ecom.menu.section', {
    type: 'flex',
    flex: ['flex-col', 'gap-3']
  });

  LayoutTemplateRegistry.register('ecom.menu.section.compact', {
    type: 'flex',
    flex: ['flex-col', 'gap-0']
  });

  LayoutTemplateRegistry.register('ecom.menu.item.row', {
    type: 'flex',
    flex: ['flex', 'items-center']
  });

  LayoutTemplateRegistry.register('ecom.hero.wrapper', {
    type: 'flex',
    flex: ['flex-col', 'gap-4']
  });

  LayoutTemplateRegistry.register('ecom.hero.wrapper.compact', {
    type: 'flex',
    flex: ['flex-col', 'gap-0']
  });

  LayoutTemplateRegistry.register('ecom.hero.card', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'gap-6', 'md:flex-row', 'md:items-stretch', 'lg:items-center']
  });

  LayoutTemplateRegistry.register('ecom.hero.copy', {
    type: 'flex',
    flex: ['flex-col', 'gap-3', 'sm:gap-4', 'w-full', 'md:w-1/2', 'min-w-0']
  });

  LayoutTemplateRegistry.register('ecom.main.outlet', {
    type: 'flex',
    flex: ['flex-col', 'gap-6', 'sm:gap-8', 'w-full', 'max-w-7xl', 'mx-auto', 'flex-1', 'min-h-0', 'min-w-0']
  });

  LayoutTemplateRegistry.register('ecom.footer.bar', {
    type: 'flex',
    flex: [
      'flex',
      'w-full',
      'shrink-0',
      'flex-col',
      'gap-3',
      'items-center',
      'text-center',
      'sm:items-start',
      'sm:text-left',
      'md:flex-row',
      'md:items-center',
      'md:justify-between',
      'md:gap-4'
    ]
  });

  LayoutTemplateRegistry.register('ecom.page.root', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'min-h-0', 'min-w-0', 'flex-1', 'gap-6', 'sm:gap-8', 'md:gap-10']
  });
}
