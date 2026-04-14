import { describe, expect, it, beforeEach } from 'vitest';
import { resolveStyle } from '../StyleResolver';
import { StyleTemplateRegistry } from '../StyleTemplateRegistry';
describe('StyleResolver', () => {
  beforeEach(() => {
    StyleTemplateRegistry.register('test.inline', {
      size: { width: 'w-full' },
      spacing: { padding: 'p-4' },
      typography: { color: 'text-gray-700' }
    });
    StyleTemplateRegistry.register('test.extra', {
      typography: { fontWeight: 'font-bold' }
    });
    StyleTemplateRegistry.register('test.compose', {
      styleTemplates: ['test.inline', 'test.extra']
    });
  });

  it('builds class string from a registered template', () => {
    const classes = resolveStyle({ styleTemplate: 'test.inline' });
    expect(classes).toContain('w-full');
    expect(classes).toContain('p-4');
    expect(classes).toContain('text-gray-700');
  });

  it('merges styleTemplates composition', () => {
    const classes = resolveStyle({ styleTemplate: 'test.compose' });
    expect(classes).toContain('w-full');
    expect(classes).toContain('font-bold');
  });

  it('resolves shell templates from test setup theme', () => {
    const shell = resolveStyle({ styleTemplate: 'shell.app.root' });
    expect(shell).toContain('min-h-dvh');
    expect(shell).toContain('flex');
  });
});
