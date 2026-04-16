import { shallowRef } from 'vue';

/** Bumped after server UI metadata is merged so route views re-resolve `PageRegistry`. */
export const pageRegistryRevision = shallowRef(0);

export function bumpPageRegistryRevision(): void {
  pageRegistryRevision.value++;
}
