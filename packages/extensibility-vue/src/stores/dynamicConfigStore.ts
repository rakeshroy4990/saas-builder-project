import { defineStore } from 'pinia';
import {
  DEFAULT_DYNAMIC_CONFIG,
  mergeDynamicConfig,
  type DeepPartial,
  type DynamicConfig
} from '@saas-builder/extensibility-contract';

export const useDynamicConfigStore = defineStore('extensibility.dynamic', {
  state: () => ({
    config: DEFAULT_DYNAMIC_CONFIG as DynamicConfig,
    loaded: false,
    loading: false
  }),
  actions: {
    setConfig(config: DynamicConfig) {
      this.config = config;
      this.loaded = true;
      this.loading = false;
    },
    mergePartial(partial: DeepPartial<DynamicConfig>) {
      this.config = mergeDynamicConfig(this.config, partial);
    },
    setLoading(loading: boolean) {
      this.loading = loading;
    }
  }
});
