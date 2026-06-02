import { describe, expect, it } from 'vitest';
import { expandDotKeys } from './expandDotKeys';

describe('expandDotKeys', () => {
  it('nests flat vue-i18n paths so t(hospital.brandTitle) resolves', () => {
    const nested = expandDotKeys({
      'hospital.brandTitle': 'Sunrise Pediatrics',
      'hospital.logoAlt': 'Sunrise Pediatrics logo'
    });
    expect(nested).toEqual({
      hospital: {
        brandTitle: 'Sunrise Pediatrics',
        logoAlt: 'Sunrise Pediatrics logo'
      }
    });
  });
});
