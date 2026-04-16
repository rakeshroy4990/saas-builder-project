import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAppStore } from '../../../store/useAppStore';
import { resolveMapping } from '../DataMapper';

describe('DataMapper', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('resolves mapped value from store path', () => {
    const store = useAppStore();
    store.setData('ecommerce', 'Cart', { total: 123, meta: { currency: 'USD' } });
    const value = resolveMapping({
      packageName: 'ecommerce',
      key: 'Cart',
      path: 'meta',
      property: 'currency'
    });
    expect(value).toBe('USD');
  });
});
