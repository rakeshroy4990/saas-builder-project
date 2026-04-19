import { StyleTemplateRegistry } from '../engine/StyleTemplateRegistry';

/**
 * Registers all named style templates. Concrete utility strings exist only here
 * (and in tests that register fixtures), not in page JSON or layer builders.
 */
export function registerStyleTemplates(): void {
  StyleTemplateRegistry.register('chrome.dynamic.container', {
    utilityClasses: 'min-w-0'
  });
  StyleTemplateRegistry.register('chrome.image.block', {
    utilityClasses: 'max-w-full'
  });

  StyleTemplateRegistry.register('shell.app.root', {
    utilityClasses: 'flex min-h-dvh w-full max-w-[100vw] flex-col overflow-x-hidden antialiased'
  });
  StyleTemplateRegistry.register('shell.app.content', {
    utilityClasses: 'flex min-h-0 min-w-0 flex-1 flex-col'
  });
  StyleTemplateRegistry.register('shell.page.host', {
    utilityClasses: 'flex min-h-0 min-w-0 flex-1 flex-col'
  });

  StyleTemplateRegistry.register('system.error.pageNotFound', {
    utilityClasses: 'p-4 text-red-600'
  });
  StyleTemplateRegistry.register('system.error.unknownType', {
    utilityClasses: 'text-yellow-600 text-xs'
  });
  StyleTemplateRegistry.register('system.notFound.container', {
    utilityClasses: 'p-8 text-red-600'
  });

  StyleTemplateRegistry.register('system.popup.backdrop', {
    utilityClasses: 'fixed inset-0 z-50 flex items-center justify-center bg-black/40'
  });
  StyleTemplateRegistry.register('system.popup.panel', {
    utilityClasses: 'min-w-[320px] max-w-xl rounded-xl bg-white p-6 shadow-xl'
  });
  StyleTemplateRegistry.register('system.popup.panel.chatWidget', {
    utilityClasses:
      'fixed z-50 flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none ' +
      'inset-x-4 bottom-24 h-[min(72dvh,calc(100dvh-7rem))] max-h-[min(72dvh,calc(100dvh-7rem))] ' +
      'sm:inset-x-auto sm:bottom-20 sm:right-6 sm:left-auto sm:h-[min(640px,85dvh)] sm:w-[min(92vw,520px)] sm:max-h-[85dvh] sm:rounded-[20px]'
  });
  StyleTemplateRegistry.register('system.popup.errorTitle', {
    utilityClasses: 'mb-2 text-lg font-semibold text-red-600'
  });
  StyleTemplateRegistry.register('system.popup.errorBody', {
    utilityClasses: 'mb-4 text-gray-700'
  });
  StyleTemplateRegistry.register('system.popup.closeButton', {
    utilityClasses: 'rounded bg-red-600 px-4 py-2 text-white'
  });

  StyleTemplateRegistry.register('system.toast.shell', {
    utilityClasses: 'fixed bottom-6 right-6 z-50 rounded px-5 py-3 text-white shadow-lg'
  });
  StyleTemplateRegistry.register('system.toast.error', {
    background: { color: 'bg-red-500' }
  });
  StyleTemplateRegistry.register('system.toast.success', {
    background: { color: 'bg-green-500' }
  });
  StyleTemplateRegistry.register('system.toast.info', {
    background: { color: 'bg-blue-500' }
  });

  StyleTemplateRegistry.register('form.label.stack', {
    utilityClasses: 'flex flex-col gap-1'
  });
  StyleTemplateRegistry.register('form.checkbox.label', {
    utilityClasses: 'flex items-center gap-2'
  });
  StyleTemplateRegistry.register('form.radio.fieldset', {
    utilityClasses: 'flex flex-col gap-2'
  });
  StyleTemplateRegistry.register('form.radio.option', {
    utilityClasses: 'flex items-center gap-2'
  });

  StyleTemplateRegistry.register('semantic.button.primary', {
    background: { color: 'bg-blue-600' },
    typography: { color: 'text-white', fontWeight: 'font-semibold' },
    spacing: { padding: 'px-6 py-2' },
    border: { radius: 'rounded-lg' }
  });

  StyleTemplateRegistry.register('semantic.button.danger', {
    background: { color: 'bg-red-500' },
    typography: { color: 'text-white' },
    spacing: { padding: 'px-6 py-2' }
  });

  StyleTemplateRegistry.register('ecom.page.shell', {
    styleTemplates: ['ecom.page.shell.background', 'ecom.page.shell.padding']
  });
  StyleTemplateRegistry.register('ecom.page.shell.background', {
    background: { color: 'bg-slate-50' }
  });
  StyleTemplateRegistry.register('ecom.page.shell.padding', {
    spacing: { padding: 'pt-6 px-4 sm:pt-8 sm:px-6 md:px-10 lg:px-12' }
  });

  StyleTemplateRegistry.register('ecom.header.logo', {
    size: { width: 'w-10', height: 'h-10' },
    border: { radius: 'rounded-full' }
  });
  StyleTemplateRegistry.register('ecom.header.brandTitle', {
    typography: {
      fontSize: 'text-xl sm:text-2xl',
      fontWeight: 'font-extrabold',
      color: 'text-slate-900'
    }
  });
  StyleTemplateRegistry.register('ecom.header.navButton', {
    styleTemplates: ['ecom.header.navButton.type', 'ecom.header.navButton.pad', 'ecom.header.navButton.radius']
  });
  StyleTemplateRegistry.register('ecom.header.navButton.type', {
    typography: { color: 'text-slate-700', fontWeight: 'font-medium', fontSize: 'text-sm' }
  });
  StyleTemplateRegistry.register('ecom.header.navButton.pad', {
    spacing: { padding: 'px-3 py-2.5 sm:py-2' }
  });
  StyleTemplateRegistry.register('ecom.header.navButton.radius', {
    border: { radius: 'rounded-lg' }
  });

  StyleTemplateRegistry.register('ecom.header.searchInput', {
    styleTemplates: ['ecom.header.searchInput.surface', 'ecom.header.searchInput.size']
  });
  StyleTemplateRegistry.register('ecom.header.searchInput.surface', {
    background: { color: 'bg-transparent' },
    border: { width: 'border-0' },
    typography: { fontSize: 'text-sm', color: 'text-slate-700' }
  });
  StyleTemplateRegistry.register('ecom.header.searchInput.size', {
    size: { width: 'min-w-0 w-full sm:w-36 md:w-40' }
  });
  StyleTemplateRegistry.register('ecom.header.searchIcon', {
    typography: { fontSize: 'text-sm', color: 'text-slate-500' }
  });

  StyleTemplateRegistry.register('ecom.header.loginButton', {
    styleTemplates: ['ecom.header.loginButton.type', 'ecom.header.loginButton.pad', 'ecom.header.navButton.radius']
  });
  StyleTemplateRegistry.register('ecom.header.loginButton.type', {
    typography: { color: 'text-slate-700', fontWeight: 'font-medium', fontSize: 'text-xs sm:text-sm' }
  });
  StyleTemplateRegistry.register('ecom.header.loginButton.pad', {
    spacing: { padding: 'px-3 py-2.5 sm:py-2' }
  });

  StyleTemplateRegistry.register('ecom.header.cartButton', {
    styleTemplates: ['ecom.header.cartButton.type', 'ecom.header.cartButton.surface', 'ecom.header.cartButton.radius', 'ecom.header.cartButton.pad']
  });
  StyleTemplateRegistry.register('ecom.header.cartButton.type', {
    typography: { color: 'text-white', fontWeight: 'font-semibold', fontSize: 'text-sm' }
  });
  StyleTemplateRegistry.register('ecom.header.cartButton.surface', {
    background: { color: 'bg-violet-600' }
  });
  StyleTemplateRegistry.register('ecom.header.cartButton.radius', {
    border: { radius: 'rounded-full' }
  });
  StyleTemplateRegistry.register('ecom.header.cartButton.pad', {
    spacing: { padding: 'px-4 py-2.5 sm:py-2' }
  });

  StyleTemplateRegistry.register('ecom.menu.list', {
    utilityClasses:
      'flex flex-nowrap sm:flex-wrap items-center overflow-x-auto overscroll-x-contain rounded-2xl bg-white px-4 py-3 gap-4 sm:px-5 sm:gap-5 [-webkit-overflow-scrolling:touch]'
  });
  StyleTemplateRegistry.register('ecom.menu.itemText', {
    typography: {
      fontSize: 'text-sm',
      fontWeight: 'font-medium',
      color: 'text-slate-700'
    }
  });
  StyleTemplateRegistry.register('ecom.menu.sectionLabel', {
    typography: { fontSize: 'text-base', fontWeight: 'font-semibold', color: 'text-slate-700' }
  });

  StyleTemplateRegistry.register('ecom.hero.card.surface', {
    styleTemplates: ['ecom.hero.card.pad', 'ecom.hero.card.radius', 'ecom.hero.card.bg']
  });
  StyleTemplateRegistry.register('ecom.hero.card.pad', {
    spacing: { padding: 'p-4 sm:p-6 md:p-10' }
  });
  StyleTemplateRegistry.register('ecom.hero.card.radius', {
    border: { radius: 'rounded-2xl sm:rounded-3xl' }
  });
  StyleTemplateRegistry.register('ecom.hero.card.bg', {
    background: { color: 'bg-white' }
  });

  StyleTemplateRegistry.register('ecom.hero.badge', {
    typography: {
      fontSize: 'text-xs',
      color: 'text-violet-600',
      fontWeight: 'font-semibold'
    }
  });
  StyleTemplateRegistry.register('ecom.hero.title', {
    typography: {
      fontSize: 'text-2xl sm:text-3xl md:text-4xl',
      color: 'text-slate-900',
      fontWeight: 'font-extrabold'
    }
  });
  StyleTemplateRegistry.register('ecom.hero.subtitle', {
    typography: { color: 'text-slate-500' }
  });
  StyleTemplateRegistry.register('ecom.hero.sectionLabel', {
    typography: { fontSize: 'text-base', fontWeight: 'font-semibold', color: 'text-slate-700' }
  });
  StyleTemplateRegistry.register('ecom.hero.image', {
    styleTemplates: ['ecom.hero.image.size', 'ecom.hero.image.radius', 'ecom.hero.image.fit']
  });
  StyleTemplateRegistry.register('ecom.hero.image.size', {
    size: {
      width: 'w-full md:w-1/2 md:max-w-xl',
      height: 'h-48 sm:h-56 md:h-72 lg:h-80'
    }
  });
  StyleTemplateRegistry.register('ecom.hero.image.radius', {
    border: { radius: 'rounded-2xl sm:rounded-3xl' }
  });
  StyleTemplateRegistry.register('ecom.hero.image.fit', {
    display: { objectFit: 'object-cover' }
  });

  StyleTemplateRegistry.register('ecom.main.outlet.pad', {
    spacing: { padding: 'pb-2 px-0' }
  });

  StyleTemplateRegistry.register('ecom.footer.surface', {
    styleTemplates: ['ecom.footer.bg', 'ecom.footer.pad', 'ecom.footer.margin']
  });
  StyleTemplateRegistry.register('ecom.footer.bg', {
    background: { color: 'bg-white' }
  });
  StyleTemplateRegistry.register('ecom.footer.pad', {
    spacing: { padding: 'px-4 py-5 sm:px-6' }
  });
  StyleTemplateRegistry.register('ecom.footer.margin', {
    spacing: { margin: 'mt-auto' }
  });
  StyleTemplateRegistry.register('ecom.footer.brand', {
    typography: { color: 'text-black', fontWeight: 'font-bold' }
  });
  StyleTemplateRegistry.register('ecom.footer.copy', {
    typography: { color: 'text-black', fontSize: 'text-xs sm:text-sm' }
  });
}
