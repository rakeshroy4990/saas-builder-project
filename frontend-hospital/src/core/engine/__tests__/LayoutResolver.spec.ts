import { describe, expect, it } from 'vitest';
import { resolveLayout } from '../LayoutResolver';
import { LayoutTemplateRegistry } from '../../registry/LayoutTemplateRegistry';

describe('LayoutResolver', () => {
  it('returns registered layout by template id', () => {
    LayoutTemplateRegistry.register('test.row', {
      type: 'flex',
      flex: ['flex', 'items-center', 'gap-2']
    });
    const layout = resolveLayout('test.row');
    expect(layout?.type).toBe('flex');
    expect(layout?.flex?.join(' ')).toContain('items-center');
  });

  it('falls back to inline layout when template missing', () => {
    const fallback = { type: 'flex' as const, flex: ['flex-col'] };
    expect(resolveLayout('missing', fallback)).toEqual(fallback);
  });
});
