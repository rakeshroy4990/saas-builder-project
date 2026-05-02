import { defineStore } from 'pinia';

interface AppState {
  data: Record<string, Record<string, unknown>>;
  /**
   * Incremented on every `setData` / `setProperty` so components can depend on it and re-evaluate
   * declarative conditions and mappings that read nested store paths (e.g. `HomeContent.hero.videoId`).
   */
  dataRevision: number;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    data: {},
    dataRevision: 0
  }),
  actions: {
    setProperty(packageName: string, key: string, property: string, value: unknown) {
      if (!this.data[packageName]) this.data[packageName] = {};
      const bucket = this.data[packageName];
      const prev = (bucket[key] as Record<string, unknown> | undefined) ?? {};
      // Replace the slice so Vue/Pinia pick up nested changes (e.g. AuthSession after login).
      bucket[key] = { ...prev, [property]: value };
      this.dataRevision += 1;
    },
    setData(packageName: string, key: string, value: unknown) {
      if (!this.data[packageName]) this.data[packageName] = {};
      this.data[packageName][key] = value;
      this.dataRevision += 1;
    },
    getData(packageName: string, key: string): unknown {
      return this.data[packageName]?.[key];
    }
  }
});
