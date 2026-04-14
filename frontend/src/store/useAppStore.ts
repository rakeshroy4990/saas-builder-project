import { defineStore } from 'pinia';

interface AppState {
  data: Record<string, Record<string, unknown>>;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    data: {}
  }),
  actions: {
    setProperty(packageName: string, key: string, property: string, value: unknown) {
      if (!this.data[packageName]) this.data[packageName] = {};
      if (!this.data[packageName][key]) this.data[packageName][key] = {};
      (this.data[packageName][key] as Record<string, unknown>)[property] = value;
    },
    setData(packageName: string, key: string, value: unknown) {
      if (!this.data[packageName]) this.data[packageName] = {};
      this.data[packageName][key] = value;
    },
    getData(packageName: string, key: string): unknown {
      return this.data[packageName]?.[key];
    }
  }
});
