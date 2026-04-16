import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ActionEngine } from '../ActionEngine';
import { ServiceRegistry } from '../../registry/ServiceRegistry';
import type { PageConfig } from '../../types/PageConfig';

describe('ActionEngine', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('invokes registered service and onSuccess navigation', async () => {
    const push = vi.fn();
    const router = { push } as unknown as { push: (path: string) => void };
    const page: PageConfig = {
      packageName: 'ecommerce',
      pageId: 'cart',
      title: 'Cart',
      container: { children: [] }
    };
    ServiceRegistry.getInstance().register({
      packageName: 'ecommerce',
      serviceId: 'checkout',
      execute: async () => ({ responseCode: 'SUCCESS' })
    });

    const engine = new ActionEngine(page, router as never);
    await engine.execute({
      actionId: 'checkout',
      onSuccess: { actionType: 'navigate', navigate: { packageName: 'ecommerce', pageId: 'order-confirmation' } }
    });

    expect(push).toHaveBeenCalledWith('/page/ecommerce/order-confirmation');
  });
});
