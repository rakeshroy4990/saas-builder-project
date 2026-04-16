import type { ComponentDefinition } from '../../../core/types/ComponentDefinition';
import { buildStandardUiChrome } from './standardShellLayout';
import { createHeroLayer } from './heroLayout';

const HOME_ID_PREFIX = 'home';

/**
 * Standard ecommerce home: global shell + hero in the main outlet.
 * Other routes can import `buildStandardUiChrome` / `createHeroLayer` separately.
 */
export function assembleStandardHomePage(): ComponentDefinition[] {
  return buildStandardUiChrome(HOME_ID_PREFIX, [createHeroLayer(HOME_ID_PREFIX)]);
}
