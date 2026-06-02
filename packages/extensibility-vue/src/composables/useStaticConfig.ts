import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useStaticConfigStore } from '../stores/staticConfigStore';

export function useStaticConfig() {
  const store = useStaticConfigStore();
  const { config, loaded } = storeToRefs(store);
  return {
    config,
    loaded,
    app: computed(() => store.app),
    brand: computed(() => store.brand),
    flags: computed(() => store.flags),
    isFlagEnabled: (flag: string) => store.isFlagEnabled(flag)
  };
}
