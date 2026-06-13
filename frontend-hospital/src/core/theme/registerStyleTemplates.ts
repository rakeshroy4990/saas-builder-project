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
    utilityClasses:
      'w-[min(96vw,980px)] max-h-[92vh] overflow-y-auto rounded-[28px] bg-white p-5 sm:p-6 md:p-8 shadow-2xl'
  });
  StyleTemplateRegistry.register('system.popup.panel.chatWidget', {
    utilityClasses:
      'fixed z-50 flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl focus:outline-none ' +
      'inset-x-4 bottom-24 h-[min(72dvh,calc(100dvh-7rem))] max-h-[min(72dvh,calc(100dvh-7rem))] ' +
      'sm:inset-x-auto sm:bottom-20 sm:right-6 sm:left-auto sm:h-[min(640px,85dvh)] sm:w-[min(92vw,520px)] sm:max-h-[85dvh] sm:rounded-[20px]'
  });
  StyleTemplateRegistry.register('system.popup.errorTitle', {
    utilityClasses: 'mb-2 text-lg font-semibold text-slate-900'
  });
  StyleTemplateRegistry.register('system.popup.errorBody', {
    utilityClasses: 'mb-4 text-sm leading-relaxed text-slate-600'
  });
  StyleTemplateRegistry.register('system.popup.missingPage', {
    utilityClasses: 'rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm'
  });
  StyleTemplateRegistry.register('system.popup.closeButton', {
    utilityClasses:
      'inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200'
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
    utilityClasses: 'flex flex-row items-center gap-4 flex-wrap'
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

  StyleTemplateRegistry.register('hosp.section.card', {
    utilityClasses: 'rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-sm'
  });
  StyleTemplateRegistry.register('hosp.header.card', {
    utilityClasses: 'rounded-2xl bg-white/95 backdrop-blur border border-slate-200 px-4 py-3 shadow-sm'
  });
  StyleTemplateRegistry.register('hosp.header.logo', {
    utilityClasses: 'w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover'
  });
  StyleTemplateRegistry.register('hosp.header.title', {
    utilityClasses:
      'inline-block min-w-0 max-w-full truncate whitespace-nowrap text-base sm:text-lg md:text-xl font-extrabold text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.header.menuButton', {
    utilityClasses: 'max-w-full rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
  });
  StyleTemplateRegistry.register('hosp.header.menuButtonActive', {
    utilityClasses: 'max-w-full rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700'
  });
  StyleTemplateRegistry.register('hosp.header.homeIcon', {
    utilityClasses:
      'relative z-10 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40'
  });
  StyleTemplateRegistry.register('hosp.header.userButton', {
    utilityClasses:
      'hidden md:inline-flex max-w-[min(40vw,18rem)] truncate rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
  });
  StyleTemplateRegistry.register('hosp.header.authButton', {
    utilityClasses:
      'inline-flex min-w-20 items-center justify-center rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100'
  });
  /** Mobile header username → opens profile menu; no pill/shading (matches Logout as plain text control). */
  StyleTemplateRegistry.register('hosp.header.userMenuTriggerMobile', {
    utilityClasses:
      'inline-flex items-center justify-start rounded-lg px-2 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1'
  });
  StyleTemplateRegistry.register('hosp.header.ctaButton', {
    utilityClasses:
      'shrink-0 rounded-lg bg-emerald-600 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700'
  });
  StyleTemplateRegistry.register('hosp.hero.title', {
    utilityClasses: 'block text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight'
  });
  StyleTemplateRegistry.register('hosp.hero.subtitle', {
    utilityClasses: 'block text-slate-600 text-base sm:text-lg'
  });
  /**
   * Hospital content photos: `w-full` + `h-auto` + viewport-capped `max-h-*` + `object-contain`
   * so images stay responsive and are not cropped (letterboxing uses bg when needed).
   */
  StyleTemplateRegistry.register('hosp.hero.image', {
    utilityClasses:
      'min-h-0 w-full h-auto max-h-[min(70dvh,22rem)] sm:max-h-[26rem] md:max-h-[30rem] lg:max-h-[min(85dvh,40rem)] xl:max-h-[44rem] rounded-2xl bg-slate-100 object-contain'
  });
  StyleTemplateRegistry.register('hosp.hero.youtube', {
    utilityClasses:
      'relative aspect-video w-full min-h-0 max-h-[min(70dvh,22rem)] sm:max-h-[26rem] md:max-h-[30rem] lg:max-h-[min(85dvh,40rem)] xl:max-h-[44rem] overflow-hidden rounded-2xl bg-slate-100 shadow-sm'
  });
  StyleTemplateRegistry.register('hosp.button.primary', {
    utilityClasses: 'rounded-xl bg-emerald-600 text-white font-semibold px-5 py-3 hover:bg-emerald-700'
  });
  StyleTemplateRegistry.register('hosp.button.secondary', {
    utilityClasses: 'rounded-xl border border-emerald-600 text-emerald-700 font-semibold px-5 py-3 bg-white'
  });
  /** Compact CTA aligned with `hosp.form.input` height (dashboard forms, growth workspace). */
  StyleTemplateRegistry.register('hosp.button.inlineSecondary', {
    utilityClasses:
      'inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-600 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50'
  });
  StyleTemplateRegistry.register('hosp.button.inlinePrimary', {
    utilityClasses:
      'inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700'
  });
  /** Page form CTAs — same chrome as popup buttons (min-w-40 h-12); place in action rows, not full-width. */
  StyleTemplateRegistry.register('hosp.page.button.primary', {
    styleTemplates: ['hosp.popup.button.primary']
  });
  StyleTemplateRegistry.register('hosp.page.button.secondary', {
    styleTemplates: ['hosp.popup.button.secondary']
  });
  StyleTemplateRegistry.register('hosp.popup.button.primary', {
    utilityClasses:
      'inline-flex min-w-40 h-12 items-center justify-center rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white hover:bg-emerald-700'
  });
  StyleTemplateRegistry.register('hosp.popup.button.secondary', {
    utilityClasses:
      'inline-flex min-w-40 h-12 items-center justify-center rounded-xl border border-emerald-600 bg-white px-6 text-base font-semibold text-emerald-700'
  });
  StyleTemplateRegistry.register('hosp.popup.button.disabled', {
    utilityClasses:
      'inline-flex min-w-40 h-12 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 px-6 text-base font-semibold text-slate-500 cursor-not-allowed'
  });
  StyleTemplateRegistry.register('hosp.popup.linkButton', {
    utilityClasses: 'text-sm font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800'
  });
  StyleTemplateRegistry.register('hosp.popup.header.title', {
    utilityClasses: 'block text-center text-2xl sm:text-3xl font-bold text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.popup.header.closeButton', {
    utilityClasses:
      'absolute right-0 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
  });
  StyleTemplateRegistry.register('hosp.stats.value', {
    utilityClasses: 'block text-3xl font-extrabold text-emerald-700'
  });
  StyleTemplateRegistry.register('hosp.stats.label', {
    utilityClasses: 'block text-sm text-slate-600 font-medium'
  });
  StyleTemplateRegistry.register('hosp.stats.row', {
    utilityClasses: 'grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3'
  });
  StyleTemplateRegistry.register('hosp.section.heading', {
    utilityClasses: 'block text-2xl sm:text-3xl font-bold text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.section.subheading', {
    utilityClasses: 'block text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.service.card', {
    utilityClasses:
      'rounded-xl bg-white border border-slate-200 p-3 sm:p-4 shadow-sm h-full transition-shadow hover:shadow-md'
  });
  StyleTemplateRegistry.register('hosp.service.icon', {
    utilityClasses: 'col-start-2 row-start-1 block text-lg leading-none'
  });
  StyleTemplateRegistry.register('hosp.service.image', {
    utilityClasses:
      'col-start-1 row-start-1 row-span-3 self-start h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl bg-emerald-50 object-cover object-center ring-1 ring-slate-100'
  });
  StyleTemplateRegistry.register('hosp.service.title', {
    utilityClasses: 'col-start-2 row-start-2 text-base font-semibold leading-snug text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.service.description', {
    utilityClasses:
      'col-start-2 row-start-3 text-xs sm:text-sm leading-snug text-slate-600 line-clamp-3 [&:empty]:hidden'
  });
  StyleTemplateRegistry.register('hosp.services.grid', {
    utilityClasses: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-stretch'
  });
  StyleTemplateRegistry.register('hosp.doctor.card', {
    utilityClasses:
      'relative rounded-xl bg-white border border-slate-200 p-3 sm:p-4 shadow-sm h-full transition-all duration-150 hover:shadow-md hover:border-emerald-200 cursor-pointer active:scale-[0.99] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
  });
  StyleTemplateRegistry.register('hosp.doctor.image', {
    utilityClasses:
      'col-start-1 row-start-1 row-span-4 self-start h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl bg-emerald-50 object-cover object-center ring-1 ring-slate-100'
  });
  StyleTemplateRegistry.register('hosp.doctor.name', {
    utilityClasses: 'col-start-2 row-start-1 text-base font-semibold leading-snug text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.doctor.meta', {
    utilityClasses:
      'col-start-2 text-xs sm:text-sm leading-snug text-slate-600 line-clamp-2 [&:empty]:hidden'
  });
  StyleTemplateRegistry.register('hosp.doctors.grid', {
    utilityClasses: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4'
  });
  StyleTemplateRegistry.register('hosp.doctors.byDepartment', {
    utilityClasses: 'flex flex-col gap-6 sm:gap-8'
  });
  StyleTemplateRegistry.register('hosp.doctors.departmentSection', {
    utilityClasses: 'flex flex-col gap-3'
  });
  StyleTemplateRegistry.register('hosp.doctors.departmentHeading', {
    utilityClasses: 'block text-lg font-semibold text-slate-900 border-b border-emerald-100 pb-2'
  });
  StyleTemplateRegistry.register('hosp.highlight.card', {
    utilityClasses: 'rounded-xl bg-emerald-50 border border-emerald-100 p-4'
  });
  StyleTemplateRegistry.register('hosp.highlight.title', {
    utilityClasses: 'block text-base font-semibold text-emerald-900'
  });
  StyleTemplateRegistry.register('hosp.highlight.detail', {
    utilityClasses: 'block text-sm text-emerald-800'
  });
  StyleTemplateRegistry.register('hosp.highlights.grid', {
    utilityClasses: 'grid grid-cols-1 md:grid-cols-2 gap-4'
  });
  /** Blog list: single column on narrow viewports, two columns from `sm` up. */
  StyleTemplateRegistry.register('hosp.blog.previewGrid', {
    utilityClasses: 'grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch'
  });
  /** Vertical stack for list layouts (used when a grid is not desired). */
  StyleTemplateRegistry.register('hosp.section.stack', {
    utilityClasses: 'flex flex-col gap-4'
  });
  StyleTemplateRegistry.register('hosp.form.input', {
    utilityClasses: 'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.form.textarea', {
    utilityClasses: 'w-full min-h-28 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 resize-y'
  });
  StyleTemplateRegistry.register('hosp.form.inlineRow', {
    utilityClasses: 'flex items-center gap-3'
  });
  /**
   * Inline row label (register/login popups, etc.). For required fields, append a space and asterisk
   * in the label text, e.g. `Email *` or `Patient Name *` — never `* Email`.
   */
  StyleTemplateRegistry.register('hosp.form.inlineLabel', {
    utilityClasses: 'w-28 shrink-0 text-base font-semibold text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.form.inlineField', {
    utilityClasses: 'flex-1'
  });
  StyleTemplateRegistry.register('hosp.form.errorText', {
    utilityClasses: 'ml-[7.75rem] text-sm text-red-600'
  });
  StyleTemplateRegistry.register('hosp.form.infoText', {
    utilityClasses: 'block text-center text-sm font-bold text-emerald-700'
  });
  StyleTemplateRegistry.register('hosp.contact.block', {
    utilityClasses: 'block text-sm sm:text-base text-slate-700'
  });

  /**
   * Dashboard workspace panels (growth, devices, vitals). Reuse in config-driven primitives
   * instead of one-off Tailwind on each workspace screen.
   */
  StyleTemplateRegistry.register('hosp.workspace.root', {
    utilityClasses: 'space-y-6'
  });
  StyleTemplateRegistry.register('hosp.workspace.stack', {
    utilityClasses: 'space-y-4'
  });
  StyleTemplateRegistry.register('hosp.workspace.pageTitle', {
    utilityClasses: 'text-2xl font-semibold text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.workspace.pageIntro', {
    utilityClasses: 'mt-1 text-sm text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.disclaimer', {
    utilityClasses: 'mt-2 text-xs text-slate-500 italic'
  });
  StyleTemplateRegistry.register('hosp.workspace.toolbar', {
    utilityClasses: 'flex flex-wrap items-end gap-3'
  });
  StyleTemplateRegistry.register('hosp.workspace.fieldLabel', {
    utilityClasses: 'mb-1 block text-sm font-medium text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.workspace.select', {
    utilityClasses:
      'min-w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm leading-normal text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.workspace.panel', {
    utilityClasses: 'rounded-xl border border-slate-200 bg-white p-4'
  });
  StyleTemplateRegistry.register('hosp.workspace.panelMuted', {
    utilityClasses: 'rounded-xl border border-slate-200 bg-slate-50 p-4'
  });
  StyleTemplateRegistry.register('hosp.workspace.panelStack', {
    utilityClasses: 'space-y-3'
  });
  StyleTemplateRegistry.register('hosp.workspace.sectionTitle', {
    utilityClasses: 'text-lg font-semibold text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.workspace.collapsible', {
    utilityClasses: 'overflow-hidden rounded-xl border border-slate-200 bg-slate-50'
  });
  StyleTemplateRegistry.register('hosp.workspace.collapsibleTrigger', {
    utilityClasses:
      'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100/80'
  });
  StyleTemplateRegistry.register('hosp.workspace.collapsibleBody', {
    utilityClasses: 'border-t border-slate-200 px-4 py-3'
  });
  StyleTemplateRegistry.register('hosp.workspace.collapsibleList', {
    utilityClasses: 'space-y-2 text-sm text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.collapsibleListItem', {
    utilityClasses: 'flex flex-col gap-0.5 rounded-md px-2 py-1.5 sm:flex-row sm:gap-2'
  });
  StyleTemplateRegistry.register('hosp.workspace.collapsibleListItemActive', {
    utilityClasses: 'bg-emerald-50 text-emerald-950'
  });
  StyleTemplateRegistry.register('hosp.workspace.metricPill', {
    utilityClasses: 'rounded-full px-4 py-1.5 text-sm font-medium'
  });
  StyleTemplateRegistry.register('hosp.workspace.metricPillActive', {
    utilityClasses: 'bg-emerald-600 text-white'
  });
  StyleTemplateRegistry.register('hosp.workspace.metricPillInactive', {
    utilityClasses: 'bg-slate-100 text-slate-700 hover:bg-slate-200'
  });
  StyleTemplateRegistry.register('hosp.workspace.chartCard', {
    utilityClasses: 'rounded-xl border border-slate-200 bg-white p-3'
  });
  StyleTemplateRegistry.register('hosp.workspace.chartSvg', {
    utilityClasses: 'mx-auto block h-auto w-full max-w-md'
  });
  StyleTemplateRegistry.register('hosp.workspace.chartLegend', {
    utilityClasses: 'mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.callout', {
    utilityClasses:
      'mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.calloutTitle', {
    utilityClasses: 'font-medium text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.workspace.calloutStrong', {
    utilityClasses: 'font-medium text-slate-700'
  });
  StyleTemplateRegistry.register('hosp.workspace.formGrid', {
    utilityClasses: 'grid gap-3 sm:grid-cols-3'
  });
  StyleTemplateRegistry.register('hosp.workspace.input', {
    utilityClasses: 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.workspace.inputCompact', {
    utilityClasses: 'w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.workspace.hint', {
    utilityClasses: 'mt-1 text-xs text-slate-500'
  });
  StyleTemplateRegistry.register('hosp.workspace.recordingCadence', {
    utilityClasses:
      'mt-3 rounded-xl border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50 px-4 py-3 shadow-sm'
  });
  StyleTemplateRegistry.register('hosp.workspace.recordingCadenceTitle', {
    utilityClasses: 'text-sm font-bold text-emerald-900'
  });
  StyleTemplateRegistry.register('hosp.workspace.recordingCadenceBody', {
    utilityClasses: 'mt-1.5 text-sm leading-relaxed text-emerald-950'
  });
  StyleTemplateRegistry.register('hosp.workspace.loadingText', {
    utilityClasses: 'text-sm text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.historyList', {
    utilityClasses: 'mt-3 divide-y divide-slate-100'
  });
  StyleTemplateRegistry.register('hosp.workspace.historyRow', {
    utilityClasses: 'flex flex-wrap items-start justify-between gap-3 py-3 text-sm'
  });
  StyleTemplateRegistry.register('hosp.workspace.historyDate', {
    utilityClasses: 'font-medium text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.workspace.historyValues', {
    utilityClasses: 'text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.percentileGroup', {
    utilityClasses: 'shrink-0 space-y-1.5 text-right'
  });
  StyleTemplateRegistry.register('hosp.workspace.percentileHeading', {
    utilityClasses: 'text-[11px] font-medium uppercase tracking-wide text-slate-500'
  });
  StyleTemplateRegistry.register('hosp.workspace.percentileBadges', {
    utilityClasses: 'flex flex-wrap justify-end gap-1.5'
  });
  StyleTemplateRegistry.register('hosp.workspace.percentileBadge', {
    utilityClasses: 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold'
  });
  StyleTemplateRegistry.register('hosp.workspace.percentileBadgeLabel', {
    utilityClasses: 'font-medium text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.guidePanel', {
    utilityClasses: 'mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600'
  });
  StyleTemplateRegistry.register('hosp.workspace.guideTitle', {
    utilityClasses: 'font-semibold text-slate-900'
  });
  StyleTemplateRegistry.register('hosp.workspace.emptyText', {
    utilityClasses: 'text-sm text-slate-600'
  });

  /** Doctor education chat thread (DynDoctorEducationConversation). */
  StyleTemplateRegistry.register('hosp.education.conversation.userRow', {
    utilityClasses: 'flex items-start justify-end gap-2'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.userBubble', {
    utilityClasses:
      'min-w-0 w-[70%] max-w-[70%] shrink-0 rounded-3xl bg-slate-900 px-4 py-3 text-sm leading-6 text-white shadow-sm'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.userLabel', {
    utilityClasses: 'mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.userBody', {
    utilityClasses: 'whitespace-pre-wrap'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.resendButton', {
    utilityClasses:
      'mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.resendButtonFailed', {
    utilityClasses:
      'mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.assistantRow', {
    utilityClasses: 'flex justify-start'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.assistantBubble', {
    utilityClasses: 'max-w-4xl rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.assistantLabel', {
    utilityClasses:
      'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.assistantBody', {
    utilityClasses: 'whitespace-pre-wrap text-sm leading-7 text-slate-800'
  });
  StyleTemplateRegistry.register('hosp.education.conversation.metaChip', {
    utilityClasses:
      'rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600'
  });
}
