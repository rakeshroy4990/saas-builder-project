<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PageRegistry } from '../../core/registry/PageRegistry';
import { ActionEngine } from '../../core/engine/ActionEngine';
import { resolveStyle } from '../../core/engine/StyleResolver';
import DynamicContainer from './DynamicContainer.vue';
import { resolvePageRootDomId } from '../../core/utils/domId';
import { pageRegistryRevision } from '../../core/registry/pageRegistryRevision';

const route = useRoute();
const router = useRouter();

const packageName = computed(() => String(route.params.packageName ?? ''));
const pageId = computed(() => String(route.params.pageId ?? ''));
const pageConfig = computed(() => {
  void pageRegistryRevision.value;
  return PageRegistry.getInstance().get(packageName.value, pageId.value);
});

const pageRootHtmlId = computed(() => {
  const cfg = pageConfig.value;
  if (!cfg) return `${packageName.value}-${pageId.value}-page`;
  return resolvePageRootDomId({
    packageName: packageName.value,
    pageId: pageId.value,
    pageDomId: cfg.domId,
    containerDomId: cfg.container.domId
  });
});

const shellPageHost = computed(() => resolveStyle({ styleTemplate: 'shell.page.host' }));
const notFoundBox = computed(() => resolveStyle({ styleTemplate: 'system.error.pageNotFound' }));

let initGeneration = 0;
let lastInitializedKey = '';
watch(
  () => [packageName.value, pageId.value, pageConfig.value] as const,
  async ([pkg, pid, cfg]) => {
    if (!cfg?.initializeActions?.length) return;
    const key = `${pkg}:${pid}`;
    if (key === lastInitializedKey) return;
    lastInitializedKey = key;
    const generation = ++initGeneration;
    const engine = new ActionEngine(cfg, router);
    for (const action of cfg.initializeActions) {
      await engine.execute(action);
      if (generation !== initGeneration) return;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div v-if="pageConfig" :id="`${pageRootHtmlId}-host`" :class="shellPageHost">
    <DynamicContainer
      :config="pageConfig.container"
      :page-config="pageConfig"
      :html-id="pageRootHtmlId"
    />
  </div>
  <div v-else id="system-page-not-found" :class="notFoundBox">
    Page not found: {{ packageName }}/{{ pageId }}
  </div>
</template>
