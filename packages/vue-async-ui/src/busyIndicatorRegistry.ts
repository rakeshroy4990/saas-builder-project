import type { Component } from 'vue';

const registry = new Map<string, Component>();

export const BusyIndicatorRegistry = {
  defaultId: 'dots' as const,

  register(id: string, component: Component): void {
    registry.set(id, component);
  },

  resolve(id?: string): Component | undefined {
    if (id && registry.has(id)) {
      return registry.get(id);
    }
    return registry.get(BusyIndicatorRegistry.defaultId);
  }
};
