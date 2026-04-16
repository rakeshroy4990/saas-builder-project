import type { StyleConfig } from '../types/StyleConfig';

class Registry {
  private readonly templates = new Map<string, StyleConfig>();

  register(name: string, style: StyleConfig): void {
    this.templates.set(name, style);
  }

  get(name: string): StyleConfig | undefined {
    return this.templates.get(name);
  }
}

export const StyleTemplateRegistry = new Registry();
