import { defineStore } from 'pinia';
import {
  DEFAULT_STATIC_CONFIG,
  type StaticConfig
} from '@saas-builder/extensibility-contract';
import { applyBrandTokensToDom } from '../static/applyBrandTokens';

export const useStaticConfigStore = defineStore('extensibility.static', {
  state: () => ({
    config: DEFAULT_STATIC_CONFIG as StaticConfig,
    loaded: false
  }),
  getters: {
    flags: (state) => state.config.flags,
    app: (state) => state.config.app,
    brand: (state) => state.config.brand
  },
  actions: {
    setConfig(config: StaticConfig) {
      this.config = config;
      this.loaded = true;
      applyBrandTokensToDom(config);
    },
    isFlagEnabled(flagName: string): boolean {
      return Boolean(this.config.flags[flagName]);
    }
  }
});
