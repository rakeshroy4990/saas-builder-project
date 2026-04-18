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

  /** Fills the shell (`flex-1 min-h-0`); horizontal + top padding only so a last-row footer can sit flush with the viewport bottom. */
  LayoutTemplateRegistry.register('hosp.page.root', {
    type: 'flex',
    flex: [
      'flex',
      'flex-col',
      'flex-1',
      'min-h-0',
      'gap-6',
      'sm:gap-8',
      'bg-slate-50',
      'px-4',
      'pt-4',
      'pb-0',
      'sm:px-6',
      'sm:pt-6',
      'md:px-8',
      'md:pt-8'
    ]
  });
  LayoutTemplateRegistry.register('hosp.header.shell', {
    type: 'flex',
    flex: [
      'flex',
      'flex-col',
      'md:flex-row',
      'md:items-center',
      'md:justify-between',
      'gap-4',
      'sticky',
      'top-0',
      'z-20'
    ]
  });
  /** Hamburger + logo/title on one row (shell may stay `flex-col` on small screens). */
  LayoutTemplateRegistry.register('hosp.header.lead', {
    type: 'flex',
    flex: ['flex', 'flex-row', 'items-center', 'gap-3', 'min-w-0', 'w-full', 'md:w-auto']
  });
  LayoutTemplateRegistry.register('hosp.header.brand', {
    type: 'flex',
    flex: ['flex', 'min-w-0', 'shrink-0', 'items-center', 'gap-3']
  });
  LayoutTemplateRegistry.register('hosp.header.nav', {
    type: 'flex',
    flex: [
      'flex',
      'w-full',
      'min-w-0',
      'flex-wrap',
      'items-center',
      'gap-2',
      'md:flex-1',
      'md:w-auto',
      'md:justify-center'
    ]
  });
  LayoutTemplateRegistry.register('hosp.header.actions', {
    type: 'flex',
    flex: [
      'flex',
      'w-full',
      'min-w-0',
      'flex-wrap',
      'items-center',
      'gap-2',
      'sm:justify-end',
      'md:w-auto',
      'md:shrink-0',
      'md:flex-nowrap',
      'md:justify-end'
    ]
  });
  LayoutTemplateRegistry.register('hosp.hero.section', {
    type: 'grid',
    grid: ['grid', 'gap-4', 'sm:gap-6', 'grid-cols-1', 'lg:grid-cols-2', 'items-stretch']
  });
  LayoutTemplateRegistry.register('hosp.hero.copy', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'gap-3', 'sm:gap-4', 'justify-center']
  });
  LayoutTemplateRegistry.register('hosp.stats.row', {
    type: 'grid',
    grid: ['grid', 'grid-cols-1', 'sm:grid-cols-3', 'gap-3', 'sm:gap-4']
  });
  LayoutTemplateRegistry.register('hosp.stat.card', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'items-center', 'text-center', 'gap-1']
  });
  LayoutTemplateRegistry.register('hosp.section.stack', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'gap-4']
  });
  LayoutTemplateRegistry.register('hosp.services.grid', {
    type: 'grid',
    grid: ['grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-4']
  });
  LayoutTemplateRegistry.register('hosp.service.card', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'gap-2']
  });
  LayoutTemplateRegistry.register('hosp.doctors.grid', {
    type: 'grid',
    grid: ['grid', 'grid-cols-1', 'md:grid-cols-3', 'gap-4', 'items-stretch']
  });
  LayoutTemplateRegistry.register('hosp.doctor.card', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'gap-2']
  });
  LayoutTemplateRegistry.register('hosp.highlights.grid', {
    type: 'grid',
    grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4']
  });
  LayoutTemplateRegistry.register('hosp.highlight.card', {
    type: 'flex',
    flex: ['flex', 'flex-col', 'gap-1']
  });
  LayoutTemplateRegistry.register('hosp.form.grid', {
    type: 'grid',
    grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4']
  });
  LayoutTemplateRegistry.register('hosp.form.actions', {
    type: 'flex',
    flex: ['flex', 'gap-3', 'flex-wrap']
  });
  LayoutTemplateRegistry.register('hosp.popup.header', {
    type: 'flex',
    flex: ['flex', 'items-center', 'justify-center', 'relative', 'min-h-10']
  });
}
