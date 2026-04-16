/**
 * Ecommerce layout building blocks — import from here to compose pages or other packages.
 *
 * @example
 * // Full shell + custom outlet
 * children: buildStandardUiChrome('shop', [createProductGrid()], { includeMenu: true })
 *
 * @example
 * // Custom stack (e.g. landing without global menu)
 * children: [
 *   createHeaderLayer('landing', { brandText: 'POPUP' }),
 *   createStandardMainOutlet('landing', [createHeroLayer('landing')]),
 *   createFooterLayer('landing'),
 * ]
 */
export type { FooterLayoutOptions } from './footerLayout';
export type { HeaderLayoutOptions } from './headerLayout';
export type { StandardUiChromeOptions } from './standardShellLayout';

export { createFooterLayer } from './footerLayout';
export { createHeaderLayer } from './headerLayout';
export { createHeroLayer } from './heroLayout';
export { createMenuLayer } from './menuLayout';
export { createStandardMainOutlet } from './mainOutletLayout';
export { assembleStandardHomePage } from './assembleStandardHomePage';
export { buildStandardUiChrome } from './standardShellLayout';
