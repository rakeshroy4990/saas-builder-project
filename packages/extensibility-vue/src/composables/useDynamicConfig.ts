import { storeToRefs } from 'pinia';
import { useDynamicConfigStore } from '../stores/dynamicConfigStore';

export function useDynamicConfig() {
  const store = useDynamicConfigStore();
  const { config, loaded, loading } = storeToRefs(store);
  return { config, loaded, loading };
}
