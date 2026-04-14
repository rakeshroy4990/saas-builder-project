import type { LayoutConfig } from '../types/ComponentDefinition';

class Registry {
  private readonly templates = new Map<string, LayoutConfig>();

  register(name: string, layout: LayoutConfig): void {
    this.templates.set(name, layout);
  }

  get(name: string): LayoutConfig | undefined {
    return this.templates.get(name);
  }
}

export const LayoutTemplateRegistry = new Registry();
