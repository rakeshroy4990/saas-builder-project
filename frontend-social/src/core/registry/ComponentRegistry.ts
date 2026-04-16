import type { Component } from 'vue';

export class ComponentRegistry {
  private static readonly map = new Map<string, Component>();

  static register(type: string, component: Component): void {
    ComponentRegistry.map.set(type, component);
  }

  static get(type: string): Component | undefined {
    return ComponentRegistry.map.get(type);
  }
}
