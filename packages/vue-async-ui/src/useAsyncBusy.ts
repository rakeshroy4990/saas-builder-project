import { ref } from 'vue';

export function useAsyncBusy() {
  const pending = ref(false);

  async function runExclusive<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (pending.value) {
      return undefined;
    }
    pending.value = true;
    try {
      return await fn();
    } finally {
      pending.value = false;
    }
  }

  return { pending, runExclusive };
}
