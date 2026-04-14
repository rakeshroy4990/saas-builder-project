<script setup lang="ts">
import { computed } from 'vue';
import { usePopupStore } from '../../store/usePopupStore';
import { PageRegistry } from '../../core/registry/PageRegistry';
import { resolveStyle } from '../../core/engine/StyleResolver';
import DynamicContainer from '../renderer/DynamicContainer.vue';
import { resolvePageRootDomId } from '../../core/utils/domId';
import { pageRegistryRevision } from '../../core/registry/pageRegistryRevision';

const popupStore = usePopupStore();
const pageConfig = computed(() => {
  void pageRegistryRevision.value;
  if (!popupStore.pageId || !popupStore.packageName) return null;
  return PageRegistry.getInstance().get(popupStore.packageName, popupStore.pageId) ?? null;
});

const backdropClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.backdrop' }));
const panelClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.panel' }));
const errorTitleClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.errorTitle' }));
const errorBodyClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.errorBody' }));
const closeButtonClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.closeButton' }));

const popupPageRootId = computed(() => {
  if (!popupStore.packageName || !popupStore.pageId) return 'system-popup-page';
  const cfg = pageConfig.value;
  return resolvePageRootDomId({
    packageName: popupStore.packageName,
    pageId: popupStore.pageId,
    pageDomId: cfg?.domId,
    containerDomId: cfg?.container.domId,
    fallbackId: `${popupStore.packageName}-${popupStore.pageId}-popup-page`
  });
});
</script>

<template>
  <Teleport to="body">
    <div v-if="popupStore.isOpen" id="system-popup-backdrop" :class="backdropClass">
      <div id="system-popup-panel" :class="panelClass">
        <template v-if="popupStore.isError">
          <h2 id="system-popup-error-title" :class="errorTitleClass">Error</h2>
          <p id="system-popup-error-body" :class="errorBodyClass">{{ popupStore.errorMessage }}</p>
          <button
            id="system-popup-close"
            type="button"
            :class="closeButtonClass"
            @click="popupStore.close"
          >
            Close
          </button>
        </template>
        <template v-else-if="pageConfig">
          <DynamicContainer
            :config="pageConfig.container"
            :page-config="pageConfig"
            :html-id="popupPageRootId"
          />
        </template>
      </div>
    </div>
  </Teleport>
</template>
