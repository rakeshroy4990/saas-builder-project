<script setup lang="ts">
import { computed, onMounted } from 'vue';
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

onMounted(async () => {
  if (!pageConfig.value?.initializeActions) return;
  const engine = new ActionEngine(pageConfig.value, router);
  for (const action of pageConfig.value.initializeActions) {
    await engine.execute(action);
  }
});
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
