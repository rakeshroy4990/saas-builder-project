import { defineStore } from 'pinia';

interface LoadingState {
  keys: Record<string, boolean>;
}

export const useLoadingStore = defineStore('loading', {
  state: (): LoadingState => ({ keys: {} }),
  getters: {
    isLoading: (state) => (key: string) => Boolean(state.keys[key])
  },
  actions: {
    start(key: string) {
      this.keys[key] = true;
    },
    stop(key: string) {
      this.keys[key] = false;
    }
  }
});
